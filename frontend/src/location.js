export const PRECISE_LOCATION_METERS = 200;

export function accuracyLabel(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.ceil(meters)} m`;
}

export function validPoint(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng) &&
    Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

// A fresh browser fix is an estimate, even with enableHighAccuracy enabled.
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is unavailable. Choose a landmark or place a pin.'));
    navigator.geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      if (!validPoint(point) || !Number.isFinite(point.accuracy)) return reject(new Error('Invalid location estimate. Please place a pin.'));
      resolve(point);
    }, error => reject(new Error(error.code === 1
      ? 'Location permission was denied. Enable it in your browser or place a pin.'
      : 'Could not obtain a fresh location. Try again or place a pin.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
