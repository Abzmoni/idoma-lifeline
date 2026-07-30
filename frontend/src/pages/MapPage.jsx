import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';
import ShaderCanvas from '../components/ShaderCanvas';

const ROAD_ROUTE_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';
const HAZARD_ROUTE_RADIUS_KM = 4.5;

function toLeafletLatLngs(points) {
  return points.map(point => [point.lat, point.lng]);
}

function distanceKm(a, b) {
  const earthRadiusKm = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function pointToSegmentDistanceKm(point, start, end) {
  const meanLat = ((start.lat + end.lat + point.lat) / 3) * Math.PI / 180;
  const toXY = (coord) => ({
    x: coord.lng * Math.cos(meanLat) * 111.32,
    y: coord.lat * 110.57
  });

  const p = toXY(point);
  const s = toXY(start);
  const e = toXY(end);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return distanceKm(point, start);
  }

  const t = Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / lenSq));
  const closest = {
    x: s.x + t * dx,
    y: s.y + t * dy
  };

  return Math.hypot(p.x - closest.x, p.y - closest.y);
}

function analyzeRouteHazards(route, hazards) {
  let nearestHazard = null;
  let nearestDistance = Infinity;

  for (const hazard of hazards) {
    for (let index = 1; index < route.length; index++) {
      const distance = pointToSegmentDistanceKm(hazard, route[index - 1], route[index]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestHazard = hazard;
      }
    }
  }

  return {
    hazard: nearestDistance <= HAZARD_ROUTE_RADIUS_KM ? nearestHazard : null,
    distanceKm: nearestDistance
  };
}

function buildDetourWaypoints(start, end, hazard) {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const length = Math.hypot(dx, dy) || 1;
  const offsetDeg = 0.08;
  const perpA = { lat: -dx / length, lng: dy / length };
  const perpB = { lat: dx / length, lng: -dy / length };

  return [
    { lat: hazard.lat + perpA.lat * offsetDeg, lng: hazard.lng + perpA.lng * offsetDeg },
    { lat: hazard.lat + perpB.lat * offsetDeg, lng: hazard.lng + perpB.lng * offsetDeg }
  ];
}

async function fetchRoadRoute(points) {
  const coordinates = points.map(point => `${point.lng},${point.lat}`).join(';');
  const response = await fetch(`${ROAD_ROUTE_ENDPOINT}/${coordinates}?overview=full&geometries=geojson&steps=false`);

  if (!response.ok) {
    throw new Error(`Road routing failed with status ${response.status}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error('No road route returned');
  }

  return {
    route: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceMeters: route.distance,
    durationSeconds: route.duration
  };
}

export default function MapPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Safe routing state
  const [isRoutingActive, setIsRoutingActive] = useState(false);
  const [routeStart, setRouteStart] = useState('otukpo');
  const [routeEnd, setRouteEnd] = useState('apa');
  const [calculatedRoute, setCalculatedRoute] = useState(null);
  const [avoidedCount, setAvoidedCount] = useState(0);
  const [isLegendActive, setIsLegendActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [routeAlert, setRouteAlert] = useState('');
  const [routeDistance, setRouteDistance] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  
  // Leaflet references
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const routePolyline = useRef(null);
  const routeMarkers = useRef([]);
  const currentLocationMarker = useRef(null);
  const currentAccuracyCircle = useRef(null);
  const hasCenteredOnCurrentLocation = useRef(false);

  // Preset routing landmarks coordinates for demo
  const ROUTING_LANDMARKS = {
    otukpo: { label: 'Otukpo (Main City)', lat: 7.1904, lng: 8.1345 },
    otukpo_market: { label: 'Otukpo Market', lat: 7.1930, lng: 8.1380 },
    st_marys: { label: 'St. Mary\'s Church', lat: 7.1950, lng: 8.1250 },
    ugbokolo: { label: 'Ugbokolo Town', lat: 6.9850, lng: 7.9800 },
    adoka: { label: 'Adoka Community', lat: 7.1610, lng: 7.9300 },
    apa: { label: 'Apa (Displaced Region)', lat: 7.5833, lng: 7.8333 },
    agatu: { label: 'Agatu (Hazard Border)', lat: 7.8856, lng: 7.9136 }
  };

  // Monitor network status
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    const onSynced = () => loadResources();

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('idoma-lifeline_synced', onSynced);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('idoma-lifeline_synced', onSynced);
    };
  }, []);

  // Load resources from DB
  const loadResources = async () => {
    try {
      const data = await api.getResources();
      setResources(data);
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      // Center Otukpo
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([7.1904, 8.1345], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(mapInstance.current);

      // Add Zoom Control at bottom right (cleaner layout)
      L.control.zoom({
        position: 'bottomright'
      }).addTo(mapInstance.current);

      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
  }, []);

  // Show the user's current location only while the app is live/online
  useEffect(() => {
    if (isOffline) {
      setCurrentLocation(null);
      setGeoStatus('offline');
      setRouteStart(prev => prev === 'current_location' ? 'otukpo' : prev);
      hasCenteredOnCurrentLocation.current = false;
      if (currentLocationMarker.current) {
        currentLocationMarker.current.remove();
        currentLocationMarker.current = null;
      }
      if (currentAccuracyCircle.current) {
        currentAccuracyCircle.current.remove();
        currentAccuracyCircle.current = null;
      }
      return undefined;
    }

    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      return undefined;
    }

    setGeoStatus('locating');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(nextLocation);
        setGeoStatus('active');

        if (!mapInstance.current) return;

        const userIcon = L.divIcon({
          className: 'current-location-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 bg-tertiary/30 rounded-full animate-ping"></div>
              <div class="relative w-4 h-4 bg-tertiary rounded-full border-2 border-white shadow-lg"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        if (!currentLocationMarker.current) {
          currentLocationMarker.current = L.marker([nextLocation.lat, nextLocation.lng], { icon: userIcon })
            .addTo(mapInstance.current)
            .bindTooltip('Your live location', { permanent: false, direction: 'top' });
        } else {
          currentLocationMarker.current.setLatLng([nextLocation.lat, nextLocation.lng]);
        }

        if (!currentAccuracyCircle.current) {
          currentAccuracyCircle.current = L.circle([nextLocation.lat, nextLocation.lng], {
            radius: Math.min(nextLocation.accuracy || 50, 500),
            color: '#005da8',
            weight: 1,
            fillColor: '#005da8',
            fillOpacity: 0.08
          }).addTo(mapInstance.current);
        } else {
          currentAccuracyCircle.current
            .setLatLng([nextLocation.lat, nextLocation.lng])
            .setRadius(Math.min(nextLocation.accuracy || 50, 500));
        }

        if (!hasCenteredOnCurrentLocation.current) {
          mapInstance.current.setView([nextLocation.lat, nextLocation.lng], 14);
          hasCenteredOnCurrentLocation.current = true;
        }
      },
      (error) => {
        console.error('Live location unavailable:', error);
        setGeoStatus('blocked');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOffline]);

  // Re-draw markers when resources or filter changes
  useEffect(() => {
    if (!markersLayer.current || !mapInstance.current) return;

    markersLayer.current.clearLayers();

    // Filter resources
    const filtered = resources.filter(res => {
      if (activeFilter && res.type !== activeFilter) return false;
      return true;
    });

    filtered.forEach(res => {
      const colors = {
        shelter: '#A85C32',
        water: '#1C6E8C',
        medical: '#C4453C',
        food: '#C99A2E',
        safe_zone: '#1F8A78',
        hazard: '#C4453C'
      };
      
      const icons = {
        shelter: 'house',
        water: 'water_drop',
        medical: 'local_hospital',
        food: 'ramen_dining',
        safe_zone: 'security',
        hazard: 'warning'
      };

      const color = colors[res.type] || '#E8600C';
      const iconName = icons[res.type] || 'explore';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="flex flex-col items-center cursor-pointer">
            <div style="background-color: ${color};" class="p-1 rounded-sm border border-white shadow-sm flex items-center justify-center w-8 h-8 z-10 text-white hover:scale-110 active:scale-125 transition-transform duration-100">
              <span class="material-symbols-outlined text-[18px] !leading-none">${iconName}</span>
            </div>
            <div style="border-top-color: ${color}; border-left-color: transparent; border-right-color: transparent; border-bottom-color: transparent; border-width: 6px 6px 0 6px;" class="w-0 h-0 -mt-[1px]"></div>
          </div>
        `,
        iconSize: [32, 38],
        iconAnchor: [16, 38]
      });

      const marker = L.marker([res.lat, res.lng], { icon: customIcon });
      marker.on('click', () => {
        setSelectedResource(res);
        mapInstance.current.setView([res.lat, res.lng], 13);
      });
      markersLayer.current.addLayer(marker);
    });
  }, [resources, activeFilter]);

  const resolveStartPoint = (startKey) => {
    if (startKey === 'current_location') {
      if (currentLocation && !isOffline) {
        return {
          label: 'Your live location',
          lat: currentLocation.lat,
          lng: currentLocation.lng
        };
      }

      return {
        ...ROUTING_LANDMARKS.otukpo,
        label: 'Otukpo fallback'
      };
    }

    return ROUTING_LANDMARKS[startKey];
  };

  const calculateSafeRoadRoute = async (startPt, endPt) => {
    const hazards = resources.filter(resource => resource.type === 'hazard' && resource.status === 'verified');

    try {
      const directRoad = await fetchRoadRoute([startPt, endPt]);
      const directHazard = analyzeRouteHazards(directRoad.route, hazards);

      if (!directHazard.hazard) {
        return {
          ...directRoad,
          avoided_hazards_count: 0,
          alert: 'Road route is clear. No verified hazards detected.',
          usedRoads: true
        };
      }

      const candidates = [];
      const waypoints = buildDetourWaypoints(startPt, endPt, directHazard.hazard);

      for (const waypoint of waypoints) {
        try {
          const detourRoad = await fetchRoadRoute([startPt, waypoint, endPt]);
          const detourHazard = analyzeRouteHazards(detourRoad.route, hazards);
          candidates.push({
            ...detourRoad,
            hazardStillOnRoute: Boolean(detourHazard.hazard),
            clearanceKm: detourHazard.distanceKm
          });
        } catch (error) {
          console.warn('Detour candidate failed:', error);
        }
      }

      const safeCandidate = candidates
        .filter(candidate => !candidate.hazardStillOnRoute)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

      const bestCandidate = safeCandidate || candidates.sort((a, b) => b.clearanceKm - a.clearanceKm)[0];

      if (bestCandidate) {
        return {
          ...bestCandidate,
          avoided_hazards_count: 1,
          alert: `Hazard detected near ${directHazard.hazard.name}. Alternate road route selected.`,
          usedRoads: true
        };
      }

      return {
        ...directRoad,
        avoided_hazards_count: 1,
        alert: `Hazard detected near ${directHazard.hazard.name}. No safer road detour was returned.`,
        usedRoads: true
      };
    } catch (error) {
      console.warn('Road routing unavailable; falling back to local safe-route engine:', error);
      const fallback = await api.getRoute(
        { lat: startPt.lat, lng: startPt.lng },
        { lat: endPt.lat, lng: endPt.lng }
      );

      return {
        route: fallback.route,
        avoided_hazards_count: fallback.avoided_hazards_count,
        alert: fallback.avoided_hazards_count > 0
          ? 'Road routing unavailable. Local hazard-avoidance fallback generated a detour.'
          : 'Road routing unavailable. Local fallback found no hazards on the direct path.',
        usedRoads: false
      };
    }
  };

  const drawRoute = (data, startPt, endPt) => {
    if (!mapInstance.current) return;

    if (routePolyline.current) {
      routePolyline.current.remove();
    }

    routeMarkers.current.forEach(marker => marker.remove());
    routeMarkers.current = [];

    routePolyline.current = L.polyline(toLeafletLatLngs(data.route), {
      color: data.avoided_hazards_count > 0 ? '#E8600C' : '#2E7D32',
      weight: 6,
      opacity: 0.9,
      dashArray: data.usedRoads ? null : '10, 10'
    }).addTo(mapInstance.current);

    const startIcon = L.divIcon({
      className: 'route-pin',
      html: `<div class="w-4 h-4 bg-tertiary rounded-full border-2 border-white pulse-ring"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    const endIcon = L.divIcon({
      className: 'route-pin',
      html: `<div class="w-4 h-4 bg-primary rounded-full border-2 border-white"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const mStart = L.marker([startPt.lat, startPt.lng], { icon: startIcon })
      .addTo(mapInstance.current)
      .bindTooltip(startPt.label || 'Route start', { permanent: false, direction: 'top' });
    const mEnd = L.marker([endPt.lat, endPt.lng], { icon: endIcon })
      .addTo(mapInstance.current)
      .bindTooltip(endPt.label || 'Destination', { permanent: false, direction: 'top' });
    routeMarkers.current = [mStart, mEnd];

    mapInstance.current.fitBounds(routePolyline.current.getBounds(), { padding: [50, 50] });
  };

  // Request & Draw Route Avoidance
  const handleCalculateRoute = async (startKey = routeStart, endKey = routeEnd, customDestination = null) => {
    const startPt = resolveStartPoint(startKey);
    const endPt = customDestination || ROUTING_LANDMARKS[endKey];
    if (!startPt || !endPt) return;

    setIsCalculatingRoute(true);
    setRouteAlert('');

    try {
      const data = await calculateSafeRoadRoute(startPt, endPt);
      setCalculatedRoute(data.route);
      setAvoidedCount(data.avoided_hazards_count);
      setRouteAlert(data.alert);
      setRouteDistance(data.distanceMeters ? data.distanceMeters / 1000 : null);
      drawRoute(data, startPt, endPt);
    } catch (error) {
      console.error('Error calculating route:', error);
      setRouteAlert('Route calculation failed. Check connectivity and try again.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const clearRoute = () => {
    if (routePolyline.current) {
      routePolyline.current.remove();
      routePolyline.current = null;
    }
    routeMarkers.current.forEach(m => m.remove());
    routeMarkers.current = [];
    setCalculatedRoute(null);
    setAvoidedCount(0);
    setRouteAlert('');
    setRouteDistance(null);
  };

  return (
    <div class="relative h-screen w-full font-body-md antialiased text-ink">
      
      {/* Leaflet Map Container */}
      <div ref={mapRef} className="absolute inset-0 z-0 bg-[#e5e5dc]"></div>
      
      {/* Animated GL Canvas Overlay */}
      <div className="absolute inset-0 w-full h-full mix-blend-overlay opacity-25 pointer-events-none z-10">
        <ShaderCanvas />
      </div>

      {/* Top App Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-touch-target bg-surface border-b border-outline-variant">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>signal_cellular_alt</span>
          <h1 className="font-headline-md text-headline-md font-bold text-primary uppercase tracking-tight">Idoma Lifeline</h1>
        </div>
        <div className="flex items-center space-x-3">
          {/* Online/Offline Status Banner */}
          {isOffline ? (
            <div className="flex items-center space-x-1.5 bg-error/10 px-2 py-1 rounded-full border border-error/20">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              <span className="font-label-caps text-label-caps text-error font-bold">OFFLINE - CACHED DATA</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-status-green/10 px-2 py-1 rounded-full border border-status-green/20">
              <div className="w-2 h-2 rounded-full bg-status-green animate-pulse"></div>
              <span className="font-label-caps text-label-caps text-status-green font-bold">LIVE</span>
            </div>
          )}

          {!isOffline && (
            <button
              onClick={() => {
                if (currentLocation && mapInstance.current) {
                  mapInstance.current.setView([currentLocation.lat, currentLocation.lng], 15);
                }
              }}
              disabled={!currentLocation}
              className={`hidden md:flex items-center space-x-1 px-2 py-1 border rounded bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-tertiary ${currentLocation ? 'border-tertiary text-tertiary hover:bg-tertiary-fixed' : 'border-border-grey text-on-surface-variant opacity-70 cursor-not-allowed'}`}
            >
              <span className="material-symbols-outlined text-[18px]">my_location</span>
              <span className="font-label-caps text-label-caps font-bold">
                {geoStatus === 'active' ? 'GPS LIVE' : geoStatus === 'locating' ? 'LOCATING' : 'GPS OFF'}
              </span>
            </button>
          )}
          
          <button 
            onClick={() => setIsRoutingActive(!isRoutingActive)}
            className={`flex items-center space-x-1 px-2 py-1 border rounded bg-white hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-signal-orange ${isRoutingActive ? 'border-primary border-2 text-primary' : 'border-border-grey text-ink'}`}
          >
            <span className="material-symbols-outlined text-[18px]">directions</span>
            <span className="font-label-caps text-label-caps font-bold">SAFE ROUTE</span>
          </button>
          
          <button 
            onClick={() => setIsLegendActive(!isLegendActive)}
            className={`flex items-center space-x-1 px-2 py-1 border rounded bg-white hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-signal-orange ${isLegendActive ? 'border-primary border-2 text-primary' : 'border-border-grey text-ink'}`}
          >
            <span className="material-symbols-outlined text-[18px]">list</span>
            <span className="font-label-caps text-label-caps font-bold">LEGEND</span>
          </button>
          
          <button 
            aria-label="Coordinator Login" 
            onClick={() => navigate('/admin/login')}
            className="text-primary hover:bg-surface-container-high p-1 rounded"
          >
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>

      {/* Floating Filter Chips */}
      <div className="absolute top-16 left-0 w-full z-40 overflow-hidden">
        <div className="flex overflow-x-auto filter-scroll px-margin-mobile py-2 space-x-2 pb-4">
          <button 
            onClick={() => setActiveFilter(null)}
            className={`flex-shrink-0 flex items-center space-x-1.5 border-2 rounded-full px-3 py-1.5 shadow-sm transition-colors ${!activeFilter ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-border-grey hover:bg-surface-container-high'}`}
          >
            <span className="font-data-sm text-data-sm font-bold uppercase tracking-wide">ALL</span>
          </button>
          
          {[
            { id: 'shelter', name: 'Shelter', icon: 'house', color: '#A85C32' },
            { id: 'water', name: 'Water', icon: 'water_drop', color: '#1C6E8C' },
            { id: 'medical', name: 'Medical', icon: 'local_hospital', color: '#C4453C' },
            { id: 'food', name: 'Food', icon: 'ramen_dining', color: '#C99A2E' },
            { id: 'safe_zone', name: 'Safe Zone', icon: 'security', color: '#1F8A78' },
            { id: 'hazard', name: 'Hazard', icon: 'warning', color: '#C4453C' }
          ].map(type => (
            <button 
              key={type.id}
              onClick={() => setActiveFilter(type.id === activeFilter ? null : type.id)}
              className={`flex-shrink-0 flex items-center space-x-1.5 border-2 rounded-full px-3 py-1.5 shadow-sm transition-colors ${type.id === activeFilter ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-border-grey hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ color: type.color, fontVariationSettings: "'FILL' 1" }}>{type.icon}</span>
              <span className="font-data-sm text-data-sm font-bold uppercase tracking-wide">{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Safe Route Planning Side Panel / Floating Sheet */}
      {isRoutingActive && (
        <div className="absolute top-32 left-4 z-40 bg-white border border-border-grey p-4 w-[320px] shadow-lg animate-[fadeIn_0.2s_ease-out]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-headline-sm text-headline-sm text-ink flex items-center gap-1">
              <span className="material-symbols-outlined text-primary">directions</span>
              Safe Navigation
            </h3>
            <button onClick={() => { setIsRoutingActive(false); clearRoute(); }} className="text-on-surface-variant hover:text-ink">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-body-md text-on-surface-variant mb-4 text-xs">
            Enter route parameters. The algorithm will automatically detour around verified hazard zones.
          </p>
          
          <div className="space-y-3">
            <div>
              <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Start Location</label>
              <select value={routeStart} onChange={e => { setRouteStart(e.target.value); clearRoute(); }} className="h-[40px] text-sm">
                {!isOffline && currentLocation && (
                  <option value="current_location">My Current Location (Live)</option>
                )}
                {Object.entries(ROUTING_LANDMARKS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {!isOffline && !currentLocation && (
                <p className="mt-1 text-[10px] text-on-surface-variant">
                  Allow browser location access to route from your live position.
                </p>
              )}
            </div>
            
            <div>
              <label className="block font-label-caps text-[10px] uppercase text-on-surface-variant mb-1">Destination Location</label>
              <select value={routeEnd} onChange={e => { setRouteEnd(e.target.value); clearRoute(); }} className="h-[40px] text-sm">
                {Object.entries(ROUTING_LANDMARKS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => handleCalculateRoute()}
              disabled={isCalculatingRoute}
              className="w-full bg-primary hover:bg-ink text-white font-label-caps text-label-caps uppercase py-2 tracking-wider mt-2 border-b-2 border-[#a23f00]"
            >
              {isCalculatingRoute ? 'CALCULATING...' : 'GENERATE ROAD ROUTE'}
            </button>
          </div>

          {calculatedRoute && (
            <div className="mt-4 pt-3 border-t border-border-grey space-y-2">
              <div className="flex items-center gap-1.5 text-status-green font-bold text-xs">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                SAFE PATH RESOLVED
              </div>
              {routeDistance && (
                <div className="bg-surface-container-high border border-border-grey p-2 text-xs text-ink font-data-sm">
                  Road distance: {routeDistance.toFixed(1)} km
                </div>
              )}
              {routeAlert && (
                <div className={`border p-2 text-xs font-data-sm ${avoidedCount > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-status-green/10 border-status-green/20 text-status-green'}`}>
                  {routeAlert}
                </div>
              )}
              {avoidedCount > 0 ? (
                <div className="bg-primary/10 border border-primary/20 p-2 text-xs text-primary font-data-sm">
                  ⚠️ Detoured around {avoidedCount} active hazard zone.
                </div>
              ) : (
                <div className="bg-status-green/10 border border-status-green/20 p-2 text-xs text-status-green font-data-sm">
                  ✅ Path is clear. No hazards encountered.
                </div>
              )}
              <button 
                onClick={clearRoute} 
                className="w-full border border-border-grey hover:bg-surface-container-high py-1 text-xs font-label-caps uppercase"
              >
                Clear Route
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button (FAB) for Reporting */}
      <button 
        onClick={() => navigate('/report')}
        aria-label="Report Incident" 
        className="absolute bottom-24 right-4 z-40 bg-signal-orange text-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_4px_12px_rgba(232,96,12,0.3)] hover:bg-[#d6550a] active:scale-95 transition-all border border-[#d6550a]"
      >
        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>add_alert</span>
      </button>

      {/* Peeking Bottom Sheet (Selected Resource Details) */}
      {selectedResource && (
        <div className="fixed bottom-[calc(48px+env(safe-area-inset-bottom))] md:bottom-6 md:left-6 md:w-[360px] w-full z-40 bg-white border border-border-grey px-4 py-3 pb-6 md:pb-4 rounded-t-xl md:rounded-none border-t-4 border-t-signal-orange shadow-lg transform transition-transform duration-300">
          <div className="w-10 h-1 bg-border-grey rounded-full mx-auto mb-3 md:hidden"></div>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div 
                style={{ 
                  backgroundColor: 
                    selectedResource.type === 'shelter' ? '#A85C32' :
                    selectedResource.type === 'water' ? '#1C6E8C' :
                    selectedResource.type === 'medical' ? '#C4453C' :
                    selectedResource.type === 'food' ? '#C99A2E' :
                    selectedResource.type === 'safe_zone' ? '#1F8A78' : '#C4453C'
                }} 
                className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 text-white border border-border-grey"
              >
                <span className="material-symbols-outlined text-[24px]">
                  {
                    selectedResource.type === 'shelter' ? 'house' :
                    selectedResource.type === 'water' ? 'water_drop' :
                    selectedResource.type === 'medical' ? 'local_hospital' :
                    selectedResource.type === 'food' ? 'ramen_dining' :
                    selectedResource.type === 'safe_zone' ? 'security' : 'warning'
                  }
                </span>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm text-ink mb-1">{selectedResource.name}</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-data-sm text-[11px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 border border-border-grey">
                    {selectedResource.lat.toFixed(4)}, {selectedResource.lng.toFixed(4)}
                  </span>
                  {selectedResource.capacity && (
                    <span className="font-data-sm text-[11px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 border border-border-grey">
                      Cap: {selectedResource.capacity}
                    </span>
                  )}
                  <span className="font-label-caps text-[10px] flex items-center text-status-green bg-status-green/10 px-1.5 py-0.5 border border-status-green/30">
                    <span className="material-symbols-outlined text-[12px] mr-0.5">verified</span>
                    VERIFIED
                  </span>
                </div>
              </div>
            </div>
            
            <button onClick={() => setSelectedResource(null)} className="text-on-surface-variant hover:text-ink">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="mt-3 text-body-md text-sm text-on-surface-variant leading-relaxed">
            {selectedResource.description || 'No description provided.'}
          </div>

          {selectedResource.contact_phone && (
            <div className="mt-2 text-xs font-data-sm flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">phone</span>
              Contact: {selectedResource.contact_phone}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button 
              onClick={() => {
                const startKey = currentLocation && !isOffline ? 'current_location' : 'otukpo';
                setRouteStart(startKey);
                // find closest routing landmark
                let closestK = 'otukpo';
                let minD = Infinity;
                Object.entries(ROUTING_LANDMARKS).forEach(([k, v]) => {
                  const d = Math.abs(v.lat - selectedResource.lat) + Math.abs(v.lng - selectedResource.lng);
                  if (d < minD) {
                    minD = d;
                    closestK = k;
                  }
                });
                setRouteEnd(closestK);
                setIsRoutingActive(true);
                handleCalculateRoute(startKey, closestK, {
                  label: selectedResource.name,
                  lat: selectedResource.lat,
                  lng: selectedResource.lng
                });
              }}
              className="flex-1 bg-signal-orange hover:bg-ink text-white font-label-caps text-label-caps uppercase py-2 px-4 text-center border-b-4 border-[#c24f08] active:border-b-0 active:translate-y-0.5 transition-all text-xs font-bold"
            >
              Route Here
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar (Mobile Layout Anchor) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-touch-target bg-surface border-t-2 border-outline pb-[env(safe-area-inset-bottom)]">
        <button className="flex flex-col items-center justify-center bg-primary text-on-primary px-4 py-1 h-full w-full max-w-[25%] transition-colors duration-200">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span>
          <span className="font-label-caps text-[10px] mt-0.5">Live Map</span>
        </button>
        <button 
          onClick={() => navigate('/report')}
          className="flex flex-col items-center justify-center text-on-background hover:bg-surface-container-high h-full w-full max-w-[25%] transition-colors duration-200"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="font-label-caps text-[10px] mt-0.5">Report</span>
        </button>
        <button 
          onClick={() => navigate('/admin')}
          className="flex flex-col items-center justify-center text-on-background hover:bg-surface-container-high h-full w-full max-w-[25%] transition-colors duration-200"
        >
          <span className="material-symbols-outlined">dashboard</span>
          <span className="font-label-caps text-[10px] mt-0.5">Admin</span>
        </button>
      {/* Legend Panel Overlay */}
      {isLegendActive && (
        <div className="absolute top-32 right-4 z-40 bg-white/95 backdrop-blur-sm border border-border-grey p-3 shadow-md w-[200px] font-data-sm text-[11px] animate-[fadeIn_0.2s_ease-out]">
          <div className="flex justify-between items-center mb-2 pb-1 border-b border-border-grey">
            <strong className="text-xs font-bold uppercase tracking-wider">Map Legend</strong>
            <button onClick={() => setIsLegendActive(false)} className="text-on-surface-variant hover:text-ink">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-shelter-brown border border-white"></div>
              <span>🏡 Shelter</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-water-blue border border-white"></div>
              <span>💧 Water Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-medical-red border border-white"></div>
              <span>🏥 Medical Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-food-gold border border-white"></div>
              <span>🍲 Food Distribution</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-safe-green border border-white"></div>
              <span>🛡️ Safe Zone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-sm bg-medical-red border-2 border-red-800 animate-pulse"></div>
              <span>⚠️ Hazard Zone</span>
            </div>
          </div>
        </div>
      )}

      </nav>

    </div>
  );
}
