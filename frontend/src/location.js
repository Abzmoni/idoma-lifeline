export const PRECISE_LOCATION_METERS = 200;
// Fixes rougher than this (e.g. a laptop's network estimate) are never used automatically.
export const USABLE_LOCATION_METERS = 2000;
const LAST_KEY = 'lifeline-last-location';

// Idoma land with a margin (roughly Benue South). A fix outside this box is almost certainly wrong:
// typically a laptop on a phone hotspot, whose position is guessed from the mobile network's
// internet gateway (often Abuja or Lagos), sometimes with a confident-looking accuracy figure.
export const SERVICE_AREA = { south: 6.55, north: 8.2, west: 7.45, east: 8.75 };
const OTUKPO = { lat: 7.1904, lng: 8.1345 };
export function inServiceArea(p) {
  return validPoint(p) && p.lat >= SERVICE_AREA.south && p.lat <= SERVICE_AREA.north && p.lng >= SERVICE_AREA.west && p.lng <= SERVICE_AREA.east;
}
// Safe to use without asking: precise enough and actually in the area this service covers.
export function usableFix(p) {
  return Boolean(p) && p.accuracy <= USABLE_LOCATION_METERS && inServiceArea(p);
}
export function kmFromOtukpo(p) {
  const rad = Math.PI / 180, a = Math.sin((p.lat - OTUKPO.lat) * rad / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(OTUKPO.lat * rad) * Math.sin((p.lng - OTUKPO.lng) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function accuracyLabel(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.ceil(meters)} m`;
}

export function validPoint(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

// Remember the last good fix on this device so the app can still place a pin when GPS or the network is unavailable.
export function rememberLocation(point) {
  if (!usableFix(point)) return; // never let a wrong far-away fix become the fallback
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ lat: point.lat, lng: point.lng, accuracy: point.accuracy, at: Date.now() })); }
  catch { /* storage unavailable: nothing remembered */ }
}

export function lastKnownLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_KEY));
    return inServiceArea(saved) && Number.isFinite(saved.at) ? saved : null;
  } catch { return null; }
}

// Minutes/hours/days since a timestamp, for "last known location (2 h ago)".
export function ageParts(at, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 60) return { n: minutes, unit: 'min' };
  if (minutes < 48 * 60) return { n: Math.round(minutes / 60), unit: 'h' };
  return { n: Math.round(minutes / 1440), unit: 'd' };
}

export async function locationPermission() {
  try { return (await navigator.permissions.query({ name: 'geolocation' })).state; }
  catch { return 'prompt'; }
}

function position(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is unavailable. Choose a landmark or place a pin.'));
    navigator.geolocation.getCurrentPosition(pos => {
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (!validPoint(point) || !Number.isFinite(point.accuracy)) return reject(new Error('Invalid location estimate. Please place a pin.'));
      rememberLocation(point);
      resolve(point);
    }, error => reject(new Error(error.code === 1
      ? 'Location permission was denied. Enable it in your browser or place a pin.'
      : 'Could not obtain a fresh location. Try again or place a pin.')), options);
  });
}

// A fresh browser fix is an estimate, even with enableHighAccuracy enabled.
export function locate() {
  return position({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// Fast fix for automatic use: accepts a reading up to 5 minutes old. GPS works without mobile data.
export function quickLocate() {
  return position({ enableHighAccuracy: true, maximumAge: 300000, timeout: 10000 });
}
