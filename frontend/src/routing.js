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
