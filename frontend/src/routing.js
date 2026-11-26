export const HAZARD_RADIUS_KM = 4.5;
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const v = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
}
function segmentDistance(point, start, end) {
  const cos = Math.cos((start.lat + end.lat + point.lat) / 3 * Math.PI / 180);
  const xy = p => ({ x: p.lng * cos * 111.32, y: p.lat * 110.57 });
  const p = xy(point), s = xy(start), e = xy(end);
  const dx = e.x - s.x, dy = e.y - s.y;
  const t = dx || dy ? Math.max(0, Math.min(1, ((p.x - s.x) * dx + (p.y - s.y) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p.x - s.x - t * dx, p.y - s.y - t * dy);
}
export function routeHazards(route, hazards) {
  return hazards.filter(h => route.some((p, i) => i > 0 && segmentDistance(h, route[i - 1], p) <= HAZARD_RADIUS_KM));
}
async function road(points) {
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Road routing is unavailable. Try again when connectivity improves.');
  const data = await response.json();
  const result = data.routes?.[0];
  if (!result?.geometry?.coordinates?.length) throw new Error('No road route was found for these locations.');
  return { points: result.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), distance: result.distance / 1000 };
}
export async function suggestedRoute(start, end, hazards, fetchRoad = road) {
  const direct = await fetchRoad([start, end]);
  const originalHazards = routeHazards(direct.points, hazards);
  let chosen = direct;
  if (originalHazards.length) {
    const hazard = originalHazards[0];
    const dx = end.lng - start.lng, dy = end.lat - start.lat, length = Math.hypot(dx, dy) || 1;
    const alternatives = await Promise.allSettled([1, -1].map(sign => fetchRoad([start, {
      lat: hazard.lat - sign * dx / length * 0.08,
      lng: hazard.lng + sign * dy / length * 0.08
    }, end])));
    const clear = alternatives.filter(r => r.status === 'fulfilled').map(r => r.value)
      .filter(r => routeHazards(r.points, hazards).length === 0).sort((a, b) => a.distance - b.distance);
    if (clear.length) chosen = clear[0];
  }
  const remaining = routeHazards(chosen.points, hazards);
  const avoided = originalHazards.filter(h => !remaining.includes(h)).length;
  return { ...chosen, remaining: remaining.length, avoided, createdAt: new Date().toISOString(),
    message: remaining.length
      ? `${remaining.length} reported hazard(s) remain near this route. No clear road alternative was found. Do not assume this route is safe.`
      : 'No currently loaded verified hazards within 4.5 km of this route. Conditions may change; confirm locally before travelling.' };
}

// ---- Offline directions -------------------------------------------------
// Road routes are saved on the phone so they still work with no network; with no saved route we
// fall back to a compass direction and straight-line distance (honestly labelled as not a road).
const SAVED_ROUTES_KEY = 'lifeline-saved-routes';
const MAX_SAVED_ROUTES = 30;
export const WALK_KMH = 4.5;

export function bearingDeg(a, b) {
  const rad = Math.PI / 180, y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
export const compassPoint = deg => ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round(deg / 45) % 8];

export function straightRoute(start, end, hazards) {
  const points = [start, end].map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  return { points, distance: distanceKm(points[0], points[1]), remaining: routeHazards(points, hazards).length, avoided: 0,
    bearing: bearingDeg(points[0], points[1]), kind: 'straight', createdAt: new Date().toISOString() };
}

function readSaved() {
  try { const list = JSON.parse(localStorage.getItem(SAVED_ROUTES_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
// Thin long geometries so dozens of routes fit comfortably in storage.
function thin(points, max = 400) {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}
export function saveRoute(start, destinationKey, route) {
  try {
    const entry = { from: { lat: start.lat, lng: start.lng }, to: destinationKey, points: thin(route.points).map(p => ({ lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) })),
      distance: route.distance, avoided: route.avoided || 0, createdAt: route.createdAt || new Date().toISOString() };
    const rest = readSaved().filter(r => !(r.to === destinationKey && distanceKm(r.from, start) < 0.3));
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify([entry, ...rest].slice(0, MAX_SAVED_ROUTES)));
  } catch { /* storage full or blocked: routes still work online */ }
}
// A saved route is reusable if it started near here: the person walks to its start, then follows it.
export function findSavedRoute(start, destinationKey, hazards, maxKm = 1.5) {
  const match = readSaved().filter(r => r.to === destinationKey && distanceKm(r.from, start) <= maxKm)
    .sort((a, b) => distanceKm(a.from, start) - distanceKm(b.from, start))[0];
  if (!match) return null;
  return { ...match, remaining: routeHazards(match.points, hazards).length, kind: 'saved', gapKm: distanceKm(match.from, start) };
}
export function hasSavedRoute(start, destinationKey) {
  return readSaved().some(r => r.to === destinationKey && distanceKm(r.from, start) <= 0.5);
}

// Best route available right now: live road route → saved road route → compass direction.
export async function bestRoute(start, end, destinationKey, hazards, { online = true, fetchRoad } = {}) {
  if (online) {
    try {
      const live = await suggestedRoute(start, end, hazards, fetchRoad);
      saveRoute(start, destinationKey, live);
      return { ...live, kind: 'road' };
    } catch { /* no signal or provider down: fall through to what works offline */ }
  }
  return findSavedRoute(start, destinationKey, hazards) || straightRoute(start, end, hazards);
}
