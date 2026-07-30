import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';

export default function ReportPage() {
  const navigate = useNavigate();
  const defaultLat = 7.1904;
  const defaultLng = 8.1345;
  const [type, setType] = useState('shelter');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [reporterContact, setReporterContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const markerRef = useRef(null);

  // Monitor network status
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Initialize mini map for location picking
  useEffect(() => {
    if (!miniMapInstance.current && miniMapRef.current) {
      miniMapInstance.current = L.map(miniMapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([defaultLat, defaultLng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(miniMapInstance.current);

      const locatorIcon = L.divIcon({
        className: 'custom-locator-marker',
        html: `
          <div class="flex flex-col items-center">
            <div class="bg-primary p-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center w-10 h-10 text-white cursor-grab active:cursor-grabbing">
              <span class="material-symbols-outlined text-[20px] font-bold">location_searching</span>
            </div>
            <div class="w-2 h-2 bg-primary rounded-full -mt-1 shadow-sm border border-white"></div>
          </div>
        `,
        iconSize: [40, 46],
        iconAnchor: [20, 46]
      });

      // Add a draggable marker
      markerRef.current = L.marker([defaultLat, defaultLng], { draggable: true, icon: locatorIcon }).addTo(miniMapInstance.current);
      
      markerRef.current.on('dragend', () => {
        const position = markerRef.current.getLatLng();
        setLat(position.lat);
        setLng(position.lng);
      });

      miniMapInstance.current.on('click', (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);
        markerRef.current.setLatLng([clickLat, clickLng]);
      });
    }
  }, []);

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        if (miniMapInstance.current && markerRef.current) {
          miniMapInstance.current.setView([latitude, longitude], 14);
          markerRef.current.setLatLng([latitude, longitude]);
        }
      }, (error) => {
        console.error('Error fetching geolocation:', error);
        alert('Could not determine your location. Please drop a pin on the map instead.');
      });
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Resource name is required');
    
    setIsSubmitting(true);

    const reportData = {
      type,
      name,
      description,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      reporter_contact: reporterContact,
      source: 'app'
    };

    try {
      const res = await api.submitReport(reportData);
      setIsSubmitting(false);

      if (res.offline) {
        // Submitted offline, show confirmation page
        navigate('/offline-success');
      } else {
        alert('Report submitted successfully! Thank you. It will appear on the public map once reviewed by a coordinator.');
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      alert('Failed to submit report. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F2EE] text-on-background p-margin-mobile md:p-margin-desktop antialiased font-body-md">
      
      <main className="w-full max-w-[560px] bg-white border border-outline mx-auto shadow-none">
        
        {/* Header indicator */}
        <div className="h-1 w-full bg-primary"></div>
        
        <div className="p-6 md:p-8">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-ink">
                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 className="font-headline-sm text-headline-sm text-on-surface">Submit Resource Report</h1>
            </div>
            {isOffline && (
              <span className="font-label-caps text-[10px] bg-error/10 text-error px-2 py-0.5 rounded border border-error/30 font-bold">
                OFFLINE MODE
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Type selection grid */}
            <fieldset className="bg-surface p-4 border border-outline-variant rounded">
              <legend className="font-label-caps text-label-caps text-on-surface mb-3 uppercase">Resource Classification *</legend>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'shelter', name: 'Shelter', icon: 'home' },
                  { id: 'water', name: 'Water', icon: 'water_drop' },
                  { id: 'medical', name: 'Medical', icon: 'local_hospital' },
                  { id: 'food', name: 'Food', icon: 'restaurant' },
                  { id: 'safe_zone', name: 'Safe Zone', icon: 'gpp_good' },
                  { id: 'hazard', name: 'Hazard', icon: 'warning', isError: true }
                ].map(cat => (
                  <label key={cat.id} className="type-chip cursor-pointer">
                    <input 
                      className="sr-only" 
                      type="radio" 
                      name="resource_type" 
                      required
                      value={cat.id} 
                      checked={type === cat.id}
                      onChange={() => setType(cat.id)}
                    />
                    <div className={`flex flex-col items-center justify-center p-3 border rounded transition-colors h-24 hover:bg-surface-container-high ${type === cat.id ? 'bg-primary text-white border-primary' : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                      <span className={`material-symbols-outlined text-[32px] mb-2 ${cat.isError && type !== cat.id ? 'text-error' : ''}`} style={{ fontVariationSettings: type === cat.id ? "'FILL' 1" : "'FILL' 0" }}>
                        {cat.icon}
                      </span>
                      <span className="font-data-sm text-data-sm uppercase tracking-wide">{cat.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Name */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Resource Title / Landmark Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. St. Mary's Secondary School Hall" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Situation Description & Capacity Info
              </label>
              <textarea 
                placeholder="e.g. Clean borehole active. Run by volunteers. Open daily. Safe drinking water. Classrooms open for up to 100 people." 
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Coordinates / Map Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Pinpoint Location on Map
                </label>
                <button 
                  type="button" 
                  onClick={handleUseMyLocation}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">my_location</span>
                  Use My GPS
                </button>
              </div>

              {/* Mini Map */}
              <div ref={miniMapRef} className="h-[220px] w-full border border-border-grey mb-3 z-0"></div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Latitude</label>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={lat} 
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setLat(v || 0);
                      if (markerRef.current) markerRef.current.setLatLng([v || 0, lng]);
                    }}
                    className="font-data-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Longitude</label>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={lng} 
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setLng(v || 0);
                      if (markerRef.current) markerRef.current.setLatLng([lat, v || 0]);
                    }}
                    className="font-data-lg text-sm bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Contact Phone Number (Optional)
              </label>
              <input 
                type="tel" 
                placeholder="e.g. +2348012345678" 
                value={reporterContact} 
                onChange={(e) => setReporterContact(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-on-surface-variant italic">
                Note: Reporter details are strictly visible to coordinators and will not be shared publicly.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-4">
              <button 
                type="button" 
                onClick={() => navigate('/')}
                className="flex-1 border-2 border-outline hover:bg-surface-container-high font-label-caps text-label-caps uppercase text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 bg-primary hover:bg-ink text-white font-label-caps text-label-caps uppercase tracking-wide border-b-4 border-[#a23f00] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center"
              >
                {isSubmitting ? 'Submitting...' : isOffline ? 'Save Offline' : 'Submit Report'}
              </button>
            </div>

          </form>

        </div>
      </main>

    </div>
  );
}
