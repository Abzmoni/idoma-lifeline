import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { addBaseMap, saveOfflineMap, offlineMapState, onOfflineMapChange, MAP_BYTES } from '../offlineMap';
import { api, syncOfflineReports, getDataStatus, getCachedResources, connectionUsable, isServerReachable } from '../api';
import db from '../db';
import { locate, quickLocate, lastKnownLocation, locationPermission, accuracyLabel, ageParts, usableFix, inServiceArea, kmFromOtukpo, PRECISE_LOCATION_METERS } from '../location';
import { distanceKm, suggestedRoute, bestRoute, saveRoute, hasSavedRoute, compassPoint, WALK_KMH } from '../routing';
import '../map.css';
import MapIcon, { iconMarkup } from '../components/MapIcon';
import Signal from '../components/Signal';
import { useI18n, translate, LANGUAGES } from '../i18n';

const LANDMARKS = {
  otukpo: { label: 'Otukpo town centre', lat: 7.1904, lng: 8.1345 },
  market: { label: 'Otukpo Market', lat: 7.193, lng: 8.138 },
  church: { label: "St. Mary's Church", lat: 7.195, lng: 8.125 },
  ugbokolo: { label: 'Ugbokolo', lat: 6.985, lng: 7.98 },
  adoka: { label: 'Adoka', lat: 7.161, lng: 7.93 },
  apa: { label: 'Apa', lat: 7.5833, lng: 7.8333 },
  agatu: { label: 'Agatu', lat: 7.8856, lng: 7.9136 }
};
const TYPES = [
  ['shelter', 'Shelter', '#92502d', 'S'], ['water', 'Water', '#166681', 'W'],
  ['medical', 'Medical', '#b73333', '+'], ['food', 'Food', '#906917', 'F'],
  ['safe_zone', 'Safe zones', '#177767', 'C'], ['hazard', 'Hazards', '#b73333', '!']
];
// A verified record not re-checked within this window is flagged as possibly outdated.
const STALE_HOURS = 72;
function parseDate(value) {
  if (!value) return null;
  const date = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateLabel(value) {
  const date = parseDate(value);
  return date ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : translate('time.unavailable');
}
function isStale(value, now = Date.now()) {
  const date = parseDate(value);
  return !date || now - date.getTime() > STALE_HOURS * 3600 * 1000;
}
const metresLabel = km => km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1)} km`;
const destinationKey = (id, isLandmark) => (isLandmark ? 'lm:' : '') + id;

const isPhone = () => window.matchMedia('(max-width: 760px)').matches;

export default function MapPage() {
  const navigate = useNavigate();
  const { t, lang, setLanguage } = useI18n();
  const typeName = id => t('type.' + id);
  const mapNode = useRef(null), map = useRef(null), markers = useRef(null), locationLayer = useRef(null), routeLayer = useRef(null);
  const locationRequest = useRef(0), routeRequest = useRef(0), prefetchedAt = useRef('');
  const [resources, setResources] = useState([]), [filter, setFilter] = useState(''), [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null), [list, setList] = useState(false), [planning, setPlanning] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine), [status, setStatus] = useState(getDataStatus());
  // On a phone the directions card starts folded to one line, so the route on the map stays in view.
  const [routeOpen, setRouteOpen] = useState(true);
  const [pending, setPending] = useState(0), [syncing, setSyncing] = useState(false), [notice, setNotice] = useState('');
  const [queueError, setQueueError] = useState('');
  const [menu, setMenu] = useState(false);
  const [offlineMap, setOfflineMap] = useState(offlineMapState());
  // Save the whole Idoma map on this device shortly after the first visit, so every street works offline.
  useEffect(() => { const stop = onOfflineMapChange(setOfflineMap); const timer = setTimeout(() => saveOfflineMap(), 3000); return () => { stop(); clearTimeout(timer); }; }, []);
  const [start, setStart] = useState('otukpo'), [end, setEnd] = useState('apa');
  const [location, setLocation] = useState(null), [confirmed, setConfirmed] = useState(false), [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false), [locationMessage, setLocationMessage] = useState('');
  const [route, setRoute] = useState(null), [routing, setRouting] = useState(false), [routeError, setRouteError] = useState('');
  const origin = start === 'location' && confirmed ? location : LANDMARKS[start];
  const visible = resources.filter(r => (!filter || r.type === filter) && r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => origin ? distanceKm(origin, a) - distanceKm(origin, b) : a.name.localeCompare(b.name));

  useEffect(() => {
    let active = true, fresh = false;
    // Show what is saved on this phone straight away; never leave the map empty while the network decides.
    getCachedResources().then(({ resources: saved, updatedAt }) => {
      if (active && !fresh && saved.length) { setResources(saved); setStatus({ cached: true, updatedAt }); }
    }).catch(() => {});
    const refresh = async () => {
      try {
        const data = await api.getResources();
        if (active && (data.length || !fresh)) { fresh = !getDataStatus().cached; setResources(data); setStatus(getDataStatus()); }
      } catch { if (active) setNotice(translate('notice.readFailed')); }
    };
    const queue = async () => {
      const reports = await db.reports_queue.toArray();
      if (active) { setPending(reports.length); setQueueError(reports.find(r => r.sync_error)?.sync_error || ''); }
    };
    const online = () => { setOffline(false); refresh(); };
    const offlineEvent = () => setOffline(true);
    const synced = event => { queue(); refresh(); if (event.detail?.count) setNotice(translate('notice.synced')); };
    const focus = () => { if (navigator.onLine) refresh(); };
    refresh(); queue();
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineEvent);
    window.addEventListener('idoma-lifeline_synced', synced);
    window.addEventListener('idoma-lifeline_queue', queue);
    window.addEventListener('focus', focus);
    const timer = setInterval(() => { queue(); if (navigator.onLine) refresh(); }, 30000);
    return () => {
      active = false; clearInterval(timer);
      window.removeEventListener('online', online); window.removeEventListener('offline', offlineEvent);
      window.removeEventListener('idoma-lifeline_synced', synced); window.removeEventListener('idoma-lifeline_queue', queue);
      window.removeEventListener('focus', focus);
    };
  }, []);

  useEffect(() => {
    map.current = L.map(mapNode.current, { zoomControl: false }).setView([7.1904, 8.1345], 12);
    addBaseMap(map.current);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    locationLayer.current = L.layerGroup().addTo(map.current);
    routeLayer.current = L.layerGroup().addTo(map.current);
    const instance = map.current;
    return () => {
      // Invalidate asynchronous work when this screen unmounts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      locationRequest.current++;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      routeRequest.current++;
      instance.remove(); map.current = null;
    };
  }, []);

  useEffect(() => {
    markers.current.clearLayers();
    resources.filter(r => (!filter || r.type === filter) && r.name.toLowerCase().includes(search.toLowerCase())).forEach(resource => {
      const [, , color] = TYPES.find(t => t[0] === resource.type) || TYPES[0];
      const label = translate('type.' + resource.type);
      const icon = L.divIcon({ className: 'resource-pin', html: `<span style="background:${color}">${iconMarkup(resource.type)}</span><i style="border-top-color:${color}"></i>`, iconSize: [36, 44], iconAnchor: [18, 44] });
      L.marker([resource.lat, resource.lng], { icon, title: `${label}: ${resource.name}` })
        .on('click', () => { setSelected(resource); setList(false); setPlanning(false); })
        .addTo(markers.current);
    });
  }, [resources, filter, search, lang]);

  // Measure "nearest" from the person, not a fixed town centre — without ever prompting on open.
  // Uses a fresh fix only if location is already allowed, otherwise the last good fix saved on this phone.
  useEffect(() => {
    let cancelled = false;
    const startedAt = locationRequest.current;
    (async () => {
      let point = null;
      if (await locationPermission() === 'granted') point = await quickLocate().catch(() => null);
      if (!usableFix(point)) {
        const last = lastKnownLocation();
        point = last && Date.now() - last.at < 7 * 86400000 ? { ...last, lastKnown: true } : null;
      }
      // Never override something the person has done since the page opened.
      if (cancelled || !point || startedAt !== locationRequest.current || !map.current) return;
      setLocation({ ...point, auto: true }); setConfirmed(true); setStart('location');
      if (L.latLng(point.lat, point.lng).distanceTo(L.latLng(7.1904, 8.1345)) < 150000) map.current.setView([point.lat, point.lng], 13, { animate: false });
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    locationLayer.current.clearLayers();
    if (!location) return;
    L.circleMarker([location.lat, location.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#005da8', fillOpacity: 1 })
      .bindTooltip(location.manual ? 'Your chosen start' : location.lastKnown ? 'Your last known location' : 'You are here (estimate)').addTo(locationLayer.current);
    if (!location.manual) L.circle([location.lat, location.lng], { radius: location.accuracy, color: '#005da8', weight: 1, fillOpacity: 0.08 }).addTo(locationLayer.current);
  }, [location]);

  useEffect(() => {
    if (!picking) return;
    const click = event => {
      setLocation({ lat: event.latlng.lat, lng: event.latlng.lng, manual: true });
      setConfirmed(true); setStart('location'); setPicking(false);
      setLocationMessage('');
      setPlanning(true);
    };
    map.current.on('click', click); map.current.getContainer().style.cursor = 'crosshair';
    return () => { map.current?.off('click', click); if (map.current) map.current.getContainer().style.cursor = ''; };
  }, [picking]);

  // While online, quietly save road routes from here to the nearest place of each kind,
  // so "Directions" still shows real roads if the network drops later.
  useEffect(() => {
    if (offline || !location || location.manual || !resources.length) return;
    const cell = location.lat.toFixed(2) + ',' + location.lng.toFixed(2);
    if (prefetchedAt.current === cell) return;
    prefetchedAt.current = cell;
    const here = { lat: location.lat, lng: location.lng };
    const hazards = resources.filter(r => r.type === 'hazard' && r.status === 'verified');
    (async () => {
      for (const [type] of TYPES.filter(([id]) => id !== 'hazard')) {
        const nearest = resources.filter(r => r.type === type).sort((a, b) => distanceKm(here, a) - distanceKm(here, b))[0];
        if (!nearest || distanceKm(here, nearest) > 80 || hasSavedRoute(here, nearest.id)) continue;
        try { saveRoute(here, nearest.id, await suggestedRoute(here, nearest, hazards)); } catch { return; }
      }
    })();
  }, [location, resources, offline]);

  const clearRoute = () => { routeRequest.current++; setRouting(false); setRoute(null); setRouteError(''); routeLayer.current?.clearLayers(); };
  const useLocation = async () => {
    setPlanning(false); setList(false); setSelected(null); setMenu(false);
    const requestId = ++locationRequest.current;
    setLocating(true); setPicking(false); setLocationMessage('Requesting a fresh location estimate…');
    clearRoute(); setConfirmed(false); setLocation(null); setStart('otukpo');
    try {
      const point = await locate();
      if (requestId !== locationRequest.current) return;
      if (!inServiceArea(point)) { setLocationMessage(`Your device says you are about ${Math.round(kmFromOtukpo(point))} km from Otukpo, far outside Idoma land, so this location was not used. On a laptop using a phone hotspot, location is guessed from the mobile network and is usually wrong. Tap "Place a pin" to show where you are, or open this app on the phone itself.`); return; }
      setLocation(point);
      const approximate = point.accuracy > PRECISE_LOCATION_METERS;
      setLocationMessage(`Browser accuracy: about ${accuracyLabel(point.accuracy)}. ${approximate ? 'This is approximate; laptops may rely on network location. Check the pin or place it yourself.' : 'Check the pin, then confirm it as your starting point.'}`);
      // Show the full reported uncertainty; never cap the circle to make it look precise.
      map.current.fitBounds(L.latLng(point.lat, point.lng).toBounds(Math.max(point.accuracy, 50) * 2), { padding: [70, 70], maxZoom: 16 });
    } catch (error) { if (requestId === locationRequest.current) setLocationMessage(error.message); }
    finally { if (requestId === locationRequest.current) setLocating(false); }
  };
  const demo = () => {
    setMenu(false);
    locationRequest.current++; clearRoute(); setLocating(false); setLocation(null); setConfirmed(false); setPicking(false);
    setStart('otukpo'); setEnd('apa'); setSelected(null); setList(false); setPlanning(false); setLocationMessage('Demo start: Otukpo town centre.');
    map.current.setView([7.1904, 8.1345], 12);
  };
  const drawRoute = (result, from) => {
    routeLayer.current.clearLayers();
    const color = result.remaining ? '#b73333' : '#005da8';
    const line = L.polyline(result.points.map(p => [p.lat, p.lng]), result.kind === 'straight'
      ? { color, weight: 5, dashArray: '1 12', lineCap: 'round' } : { color, weight: 5 }).addTo(routeLayer.current);
    // A saved route may start a short walk away: show that first stretch as a dotted line.
    if (result.kind === 'saved' && result.gapKm > 0.05) L.polyline([[from.lat, from.lng], [result.points[0].lat, result.points[0].lng]], { color, weight: 4, dashArray: '1 10', lineCap: 'round' }).addTo(routeLayer.current);
    map.current.fitBounds(line.getBounds().extend([from.lat, from.lng]), { paddingTopLeft: [50, 50], paddingBottomRight: [50, isPhone() ? 150 : 50], maxZoom: 16 });
  };
  // Works online and offline: live road route, then a road route saved on this phone, then a compass direction.
  const showRoute = async (from, destination, key) => {
    if (distanceKm(from, destination) < 0.01) { setRouteError('Choose a different destination from your starting point.'); return; }
    clearRoute(); const requestId = ++routeRequest.current; setRouting(true);
    try {
      const hazards = resources.filter(r => r.type === 'hazard' && r.status === 'verified');
      const result = await bestRoute(from, destination, key, hazards, { online: !offline && connectionUsable(), wait: isServerReachable() ? 8000 : 3000 });
      if (requestId !== routeRequest.current) return;
      Object.assign(result, { startLabel: from.label, endLabel: destination.label || destination.name, phone: destination.contact_phone, guessed: from.guessed, far: from.far });
      setRoute(result); setRouteOpen(!isPhone()); setPlanning(false); setSelected(null); setList(false);
      drawRoute(result, from);
    } catch (error) { if (requestId === routeRequest.current) setRouteError(error.message); }
    finally { if (requestId === routeRequest.current) setRouting(false); }
  };
  const youLabel = point => point.manual ? 'Your chosen pin' : point.lastKnown ? t('route.youLast') : t('route.you');
  // Directions straight from a place card: start from wherever the person is, with no form to fill.
  const routeTo = async destination => {
    let from = start === 'location' && confirmed && location ? location : null, fresh = null;
    if (!from) {
      setRouting(true);
      fresh = await quickLocate().catch(() => null);
      if (usableFix(fresh)) { from = fresh; locationRequest.current++; setLocation(fresh); setConfirmed(true); setStart('location'); }
      else { const last = lastKnownLocation(); if (last) from = { ...last, lastKnown: true }; }
    }
    const far = !from && Boolean(fresh) && !inServiceArea(fresh);
    from = from ? { ...from, label: youLabel(from) } : { ...LANDMARKS.otukpo, guessed: true, far };
    await showRoute(from, destination, destinationKey(destination.id));
  };
  const calculate = () => {
    setRouteError('');
    if (!origin) { setRouteError('Choose a landmark or confirm your starting pin.'); return; }
    const destination = LANDMARKS[end] || resources.find(r => r.id === end);
    if (!destination) { setRouteError('Please choose a destination.'); return; }
    showRoute({ ...origin, label: origin.label || youLabel(origin) }, destination, destinationKey(end, Boolean(LANDMARKS[end])));
  };
  const walkTime = km => { const mins = km / WALK_KMH * 60; return mins < 60 ? t('unit.mins', { n: Math.max(5, Math.round(mins / 5) * 5) }) : t('unit.hours', { n: Math.round(mins / 30) / 2 }); };
  const ago = at => { const a = ageParts(new Date(at).getTime()); if (a.unit === 'min' && a.n < 1) return t('route.justNow'); return `${a.n} ${t('unit.' + a.unit)}`; };
  const sync = async () => {
    setSyncing(true);
    try { const count = await syncOfflineReports(); setNotice(t(count ? 'notice.synced' : 'notice.noneSynced')); }
    catch { setNotice(t('notice.syncFailed')); }
    finally { setSyncing(false); }
  };
  const select = resource => { setSelected(resource); setList(false); setPlanning(false); map.current.setView([resource.lat, resource.lng], 14); };

  const placePin = () => {
    if (selected && selected.type !== 'hazard') setEnd(selected.id);
    locationRequest.current++; setLocating(false); clearRoute(); setPicking(!picking);
    setPlanning(false); setList(false); setSelected(null); setMenu(false); setLocationMessage('');
  };
  // One tap on a need shows the nearest matching places straight away.
  const chooseNeed = id => {
    if (filter === id) { setFilter(''); setList(false); return; }
    setFilter(id); setSearch(''); setSelected(null); setPlanning(false); setLocationMessage(''); setMenu(false);
    setList(id !== 'hazard');
  };
  const toggleList = () => { setList(!list); setPlanning(false); setSelected(null); setLocationMessage(''); setMenu(false); };
  const toggleDirections = () => { setPlanning(!planning); setList(false); setSelected(null); setLocationMessage(''); setMenu(false); };

  return <div className="lifeline-map">
    <header className="map-header">
      <div className="brand"><MapIcon name="map" /><strong>Idoma Lifeline</strong></div>
      <div className="header-actions">
        {LANGUAGES.length > 1 && <select className="language-select" aria-label={t('nav.language')} title={t('nav.language')} value={lang} onChange={e => setLanguage(e.target.value)}>{LANGUAGES.map(([code, name, short]) => <option key={code} value={code} aria-label={name}>{short}</option>)}</select>}
        <Signal state={offline ? 'offline' : status.cached ? 'saved' : 'online'} label={t(offline ? 'status.offline' : status.cached ? 'status.saved' : 'status.online')} />
        <button className={planning ? 'active header-directions' : 'header-directions'} aria-label="Directions" title={t('nav.directions')} onClick={toggleDirections}><MapIcon name="route" /><span>{t('nav.directions')}</span></button>
        <button className="coordinator-button icon-button" title={t('nav.coordinator')} aria-label="Coordinator" onClick={() => navigate('/admin/login')}><MapIcon name="user" /></button>
        <button className="icon-button" aria-label="More options" title={t('nav.more')} aria-expanded={menu} onClick={() => setMenu(!menu)}><MapIcon name="more" /></button>
      </div>
    </header>
    {menu && <aside className="map-menu"><strong>{t('menu.title')}</strong><p className="muted">{status.updatedAt ? t('menu.updated', { date: dateLabel(status.updatedAt) }) : t('menu.waiting')}</p>{offlineMap.status === 'saved' ? <p className="offline-map-note"><MapIcon name="check" />{t('map.saved', { mb: (MAP_BYTES / 1e6).toFixed(1) })}</p> : offlineMap.status === 'saving' ? <p className="offline-map-note">{t('map.saving', { pct: Math.round(offlineMap.progress * 100) })}</p> : <button onClick={() => saveOfflineMap({ force: true })} disabled={offline}><MapIcon name="map" />{t('map.save', { mb: (MAP_BYTES / 1e6).toFixed(1) })}</button>}<button onClick={demo}><MapIcon name="map" />{t('menu.demo')}</button><button onClick={placePin}><MapIcon name="pin" />{t('menu.pin')}</button><button onClick={sync} disabled={offline || syncing}>{t(syncing ? 'menu.syncing' : 'menu.sync')}</button>{LANGUAGES.length > 1 && <div className="menu-languages" role="group" aria-label={t('nav.language')}>{LANGUAGES.map(([code, name]) => <button key={code} className={lang === code ? 'active' : ''} aria-pressed={lang === code} onClick={() => setLanguage(code)}>{name}</button>)}</div>}<p className="muted">{t('menu.prototype')}<br />{t('menu.simulated')}</p></aside>}
    {(offline || (status.cached && status.updatedAt) || pending > 0 || queueError) && <div className="data-strip" role="status">
      <span>{offline ? t('strip.offline') : status.cached ? t('strip.cached') : ''}</span>
      {offline && offlineMap.status !== 'saved' && <span>{t('strip.mapMissing')}</span>}
      {pending > 0 && <span>{t(pending === 1 ? 'strip.pendingOne' : 'strip.pendingMany', { n: pending })}</span>}
      {pending > 0 && <button onClick={sync} disabled={offline || syncing}>{t(syncing ? 'menu.syncing' : 'menu.sync')}</button>}
      {queueError && <span role="alert">{t('strip.queueError', { error: queueError })}</span>}
    </div>}
    <main className="map-workspace">
      <div ref={mapNode} className="map-surface" aria-label="Emergency resources map" />
      <section className="map-discovery" aria-label="Find resources">
        <h1 className="sr-only">{t('find.heading')}</h1>
        <div className="need-filters"><button className={!filter ? 'active' : ''} onClick={() => setFilter('')}>{t('filter.all')}</button>{TYPES.map(([id, , color]) => <button key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => chooseNeed(id)}><span style={{ color: filter === id ? 'inherit' : color }}><MapIcon name={id} /></span>{typeName(id)}</button>)}</div>
        <button className={'list-toggle ' + (list ? 'active' : '')} onClick={toggleList} aria-label={t(list ? 'view.map' : 'view.list')} aria-pressed={list}><MapIcon name={list ? 'map' : 'list'} /><span>{t(list ? 'view.map' : 'view.list')}</span></button>
      </section>
      {!list && !selected && !planning && !locationMessage && !picking && !route && <div className="map-hint">{t('hint')}</div>}
      <button className="locate-control icon-button" onClick={useLocation} disabled={locating} aria-label="Use my location" title="Use my location"><MapIcon name="location" /></button>
      {(locationMessage || picking) && <div className="location-notice" role="status"><p>{picking ? 'Tap the map to choose your starting point.' : locationMessage}</p>{location && !confirmed && !picking && <button onClick={() => { clearRoute(); setConfirmed(true); setStart('location'); setLocationMessage(`Starting point confirmed by you · Browser accuracy ${accuracyLabel(location.accuracy)}`); }}>Use this estimate</button>}<button onClick={placePin}><MapIcon name="pin" />{picking ? 'Cancel pin' : 'Place a pin'}</button><button aria-label="Dismiss location message" onClick={() => { setLocationMessage(''); setPicking(false); }}>Dismiss</button></div>}
      {list && <section className="map-panel resource-list"><div className="panel-heading"><h2>{t('list.heading')}</h2><button onClick={() => setList(false)}>{t('close')}</button></div><label>{t('list.search')}<input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('list.placeholder')} /></label><p className="muted">{t('list.distances', { origin: origin?.label || t('list.yourPin') })}</p>{visible.length === 0 && <p>{t(offline ? 'list.noneOffline' : 'list.none')}</p>}{visible.map(r => <button className="resource-row" key={r.id} onClick={() => select(r)}><strong>{r.name}</strong><span>{typeName(r.type)} · {origin ? `${distanceKm(origin, r).toFixed(1)} km` : t('list.noDistance')}</span><small>{isStale(r.verified_at) && <em className="stale-badge">{t('fresh.stale')}</em>}{t('list.verified', { date: dateLabel(r.verified_at) })}</small></button>)}</section>}
      {planning && <section className="map-panel route-panel"><div className="panel-heading"><h2>Plan your journey</h2><button onClick={() => setPlanning(false)}>Close</button></div><p className="muted">Choose where you are and where you need to go.</p><div className="route-location-actions"><button aria-label="Find route starting location" onClick={useLocation} disabled={locating}>Use my location</button><button onClick={placePin}>Place a pin</button></div><label>Starting point<select value={start} onChange={e => { setStart(e.target.value); clearRoute(); }}>{confirmed && location && <option value="location">{location.manual ? 'Your chosen pin' : 'Your location'}</option>}{Object.entries(LANDMARKS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select></label><label>Destination<select value={end} onChange={e => { setEnd(e.target.value); clearRoute(); }}><optgroup label="Landmarks">{Object.entries(LANDMARKS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</optgroup><optgroup label="Resources">{resources.filter(r => r.type !== 'hazard').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup></select></label><button className="primary" disabled={routing} onClick={calculate}>{routing ? t('route.finding') : 'Show the way'}</button>{routeError && <p className="warning" role="alert">{routeError}</p>}</section>}
      {routing && !planning && <div className="map-toast" role="status">{t('route.finding')}</div>}
      {route && <aside className={`route-result ${route.remaining ? 'danger' : ''} ${routeOpen ? 'open' : 'folded'}`} role="status">
        <div className="route-head"><span className="pin-tile route-tile" aria-hidden="true">{route.kind === 'straight' ? <span className="route-arrow" style={{ transform: `rotate(${route.bearing}deg)` }}>↑</span> : <MapIcon name={route.remaining ? 'hazard' : 'route'} />}</span>
          <button className="route-summary" aria-expanded={routeOpen} aria-label={t(routeOpen ? 'route.less' : 'route.more')} onClick={() => setRouteOpen(!routeOpen)}><strong>{t('route.' + route.kind, { km: route.distance.toFixed(1), dir: t('dir.' + compassPoint(route.bearing || 0)) })}</strong><span className="route-walk">{t('route.walk', { time: walkTime(route.distance) })}</span></button>
          <button className="route-fold" aria-hidden="true" tabIndex={-1} onClick={() => setRouteOpen(!routeOpen)}><MapIcon name="chevron" /></button>
          {!routeOpen && <button className="route-x" aria-label={t('route.close')} onClick={clearRoute}>×</button>}</div>
        {!routeOpen && route.remaining > 0 && <p className="route-danger">{t('route.danger', { n: route.remaining })}</p>}
        {!routeOpen && route.far && <p className="warning">{t('route.far')}</p>}
        {routeOpen && <><p>{t('route.from', { from: route.startLabel, to: route.endLabel })}</p>
        {route.far && <p className="warning">{t('route.far')}</p>}{route.guessed && !route.far && <p className="warning">{t('route.fromGuess')}</p>}
        {route.kind === 'straight' && <p className="route-note">{t('route.straightNote', { dir: t('dir.' + compassPoint(route.bearing)) })}</p>}
        {route.kind === 'saved' && <p className="route-note">{t('route.savedNote', { age: ago(route.createdAt) })}</p>}
        {route.kind === 'saved' && route.gapKm > 0.05 && <p>{t('route.savedGap', { m: metresLabel(route.gapKm) })}</p>}
        <p className={route.remaining ? 'route-danger' : ''}>{t(route.remaining ? 'route.danger' : 'route.clear', { n: route.remaining })}</p>
        {route.avoided > 0 && <p>{t('route.avoided', { n: route.avoided })}</p>}
        <div className="card-actions">{route.phone && <a className="call-button primary-call" href={`tel:${route.phone.replace(/[^+\d]/g, '')}`}><MapIcon name="phone" />{t('details.call')}</a>}<button onClick={clearRoute}>{t('route.close')}</button></div></>}
      </aside>}
      {selected && <section className="map-panel resource-details"><div className="panel-heading"><div className="card-kind"><span className="pin-tile" style={{ background: (TYPES.find(x => x[0] === selected.type) || TYPES[0])[2] }}><MapIcon name={selected.type} /></span><span><b>{typeName(selected.type)}</b>{isStale(selected.verified_at) ? <em className="verified stale">{t('fresh.stale')}</em> : <em className="verified"><MapIcon name="check" />{t('details.verified')}</em>}</span></div><button onClick={() => setSelected(null)}>{t('close')}</button></div><h2>{selected.name}</h2><p className="resource-distance">{origin && t('details.distance', { km: distanceKm(origin, selected).toFixed(1), origin: origin.label || t('list.yourPin') })}</p><p className="muted">{t('details.lastVerified', { date: dateLabel(selected.verified_at) })}</p>{isStale(selected.verified_at) && <p className="stale-note" role="note">{t('fresh.staleNote')}</p>}<p>{selected.description || t('details.noDetails')}</p>{selected.capacity != null && <p>{t('details.capacity')} <strong>{selected.capacity}</strong> · {t('details.spacesUnknown')}</p>}<details><summary>{t('details.coordinates')}</summary><p>{Number(selected.lat).toFixed(4)}, {Number(selected.lng).toFixed(4)}</p></details><div className="card-actions">{selected.contact_phone && <a className="call-button primary-call" href={`tel:${selected.contact_phone.replace(/[^+\d]/g, '')}`}><MapIcon name="phone" />{t('details.call')}</a>}{selected.type !== 'hazard' && <button className={selected.contact_phone ? '' : 'primary'} disabled={routing} onClick={() => routeTo(selected)}><MapIcon name="route" />{t('details.directions')}</button>}</div></section>}
      {notice && <div className="map-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label={t('notice.dismiss')}>×</button></div>}
      <button className="report-action" aria-label="+ Report a resource or hazard" onClick={() => navigate('/report')}><MapIcon name="report" />{t('nav.report')}</button>
      <div className="demo-label">{t('demo.label')}</div>
    </main>
    <nav className="mobile-map-nav" aria-label="Main navigation">
      <button className="active" onClick={() => { setList(false); setSelected(null); setPlanning(false); }}><MapIcon name="map" />{t('nav.map')}</button>
      <button aria-label="+ Report a resource or hazard" onClick={() => navigate('/report')}><MapIcon name="report" />{t('nav.report')}</button>
      <button onClick={() => navigate('/admin/login')}><MapIcon name="user" />{t('nav.coordinator')}</button>
    </nav>
  </div>;
}
