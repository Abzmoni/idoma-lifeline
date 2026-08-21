import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';

export default function ResourceEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [type, setType] = useState('shelter');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(7.1904);
  const [lng, setLng] = useState(8.1345);
  const [status, setStatus] = useState('verified');
  const [capacity, setCapacity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const editMapRef = useRef(null);
  const editMapInstance = useRef(null);
  const markerRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // Load resource details
  useEffect(() => {
    const fetchResource = async () => {
      try {
        setLoading(true);
        const res = await api.getResource(id);
        
        setType(res.type);
        setName(res.name);
        setDescription(res.description || '');
        setLat(res.lat);
        setLng(res.lng);
        setStatus(res.status);
        setCapacity(res.capacity || '');
        setContactPhone(res.contact_phone || '');
        setLoading(false);

        // Update map marker if map already initialized
        if (editMapInstance.current) {
          editMapInstance.current.setView([res.lat, res.lng], 13);
          if (markerRef.current) {
            markerRef.current.setLatLng([res.lat, res.lng]);
          }
        }
      } catch (error) {
        console.error('Error fetching resource details:', error);
        alert('Failed to load resource details');
        navigate('/admin');
      }
    };

    fetchResource();
  }, [id, navigate]);

  // Initialize Map
  useEffect(() => {
    if (!loading && !editMapInstance.current && editMapRef.current) {
      editMapInstance.current = L.map(editMapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([lat, lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(editMapInstance.current);

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

      markerRef.current = L.marker([lat, lng], { draggable: true, icon: locatorIcon }).addTo(editMapInstance.current);

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        setLat(pos.lat);
        setLng(pos.lng);
      });

      editMapInstance.current.on('click', (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);
        markerRef.current.setLatLng([clickLat, clickLng]);
      });
    }
  }, [loading, lat, lng]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Name is required');

    setSaving(true);
    try {
      await api.updateResource(id, {
        type,
        name,
        description,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        status,
        capacity: capacity ? parseInt(capacity) : null,
        contact_phone: contactPhone
      });
      setSaving(false);
      alert('Resource details updated successfully!');
      navigate('/admin');
    } catch (error) {
      console.error(error);
      setSaving(false);
      alert(`Update failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F2EE]">
        <div className="font-data-sm text-sm animate-pulse">Loading Resource Details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F2EE] text-on-background p-margin-mobile md:p-margin-desktop antialiased font-body-md">
      
      <main className="w-full max-w-[560px] bg-white border border-outline mx-auto shadow-none">
        
        {/* Header Indicator */}
        <div className="h-1 w-full bg-primary"></div>
        
        <div className="p-6 md:p-8">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-outline">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/admin')} className="text-on-surface-variant hover:text-ink">
                <span className="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 className="font-headline-sm text-headline-sm text-on-surface">Modify Resource</h1>
            </div>
            <span className="font-label-caps text-[10px] bg-primary/10 text-primary px-2 py-0.5 border border-primary/30 font-bold uppercase">
              Ops Console
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Status */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Verification Status
              </label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                className="font-data-lg text-sm bg-white border-2 border-primary"
              >
                <option value="verified">✅ Verified (Publicly Visible)</option>
                <option value="pending">⚡ Pending Verification</option>
                <option value="flagged">🚨 Flagged / Suspended</option>
                <option value="archived">📁 Archived</option>
              </select>
            </div>

            {/* Category selection grid */}
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
                Resource Name
              </label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Situation Description & Notes
              </label>
              <textarea 
                rows="3"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Coordinates / Map Selection */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant">
                  Update Coordinates Pin
                </label>
                <span className="text-[10px] text-on-surface-variant font-mono">Drag pin or click map to move</span>
              </div>

              {/* Mini Map */}
              <div ref={editMapRef} className="h-[200px] w-full border border-border-grey mb-3 z-0"></div>

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

            {/* Capacity */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Capacity (People count / Liters / Bed count)
              </label>
              <input 
                type="number" 
                placeholder="e.g. 150 (Leave blank if not applicable)" 
                value={capacity} 
                onChange={(e) => setCapacity(e.target.value)}
                className="font-data-lg text-sm bg-white"
              />
            </div>

            {/* Contact */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2">
                Official Contact Phone Number
              </label>
              <input 
                type="tel" 
                placeholder="e.g. +2348012345678" 
                value={contactPhone} 
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-4">
              <button 
                type="button" 
                onClick={() => navigate('/admin')}
                className="flex-1 h-touch-target border-2 border-outline hover:bg-surface-container-high font-label-caps text-label-caps uppercase text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="flex-1 h-touch-target bg-primary hover:bg-ink text-white font-label-caps text-label-caps uppercase tracking-wide border-b-4 border-[#a23f00] active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </form>

        </div>
      </main>

    </div>
  );
}
