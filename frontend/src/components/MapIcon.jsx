const paths = {
  shelter: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
  water: '<path d="M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  food: '<path d="M4 3v6c0 3 6 3 6 0V3M7 3v18M17 3v18M17 3c-4 4-4 9 0 9"/>',
  safe_zone: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  hazard: '<path d="m12 3 10 18H2z"/><path d="M12 9v5M12 17v1"/>',
  location: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  route: '<path d="m12 2 10 10-10 10L2 12z"/><path d="M8 15v-4h8m-3-3 3 3-3 3"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
  report: '<path d="M12 4v16M4 12h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pin: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>'
};
// Shared with Leaflet's DOM markers; this pure helper holds no refresh state.
// eslint-disable-next-line react/only-export-components
export function iconMarkup(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.map}</svg>`;
}
export default function MapIcon({ name }) {
  return <span className="map-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconMarkup(name) }} />;
}
