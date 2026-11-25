export const PRECISE_LOCATION_METERS = 200;
// Fixes rougher than this (e.g. a laptop's network estimate) are never used automatically.
export const USABLE_LOCATION_METERS = 2000;
const LAST_KEY = 'lifeline-last-location';

export function accuracyLabel(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.ceil(meters)} m`;
}

export function validPoint(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

// Remember the last good fix on this device so the app can still place a pin when GPS or the network is unavailable.
export function rememberLocation(point) {
  if (!validPoint(point) || !(point.accuracy <= USABLE_LOCATION_METERS)) return;
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ lat: point.lat, lng: point.lng, accuracy: point.accuracy, at: Date.now() })); }
  catch { /* storage unavailable: nothing remembered */ }
}

export function lastKnownLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_KEY));
    return validPoint(saved) && Number.isFinite(saved.at) ? saved : null;
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
