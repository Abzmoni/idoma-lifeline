import { leafletLayer, paintRules, labelRules, LineSymbolizer, exp } from 'protomaps-leaflet';
import { namedFlavor } from '@protomaps/basemaps';

// Warm, high-contrast palette close to the OpenStreetMap colours people know: main roads stand out,
// buildings are visible, and names stay readable in bright sunlight.
const FLAVOR = (() => {
  const f = namedFlavor('light');
  const roads = {
    highway: '#f6a46b', highway_casing_early: '#c7713a', highway_casing_late: '#c7713a',
    major: '#fcd7a1', major_casing_early: '#c59a5d', major_casing_late: '#c59a5d',
    link: '#fcd7a1', link_casing: '#c59a5d',
    minor_a: '#ffffff', minor_b: '#ffffff', minor_casing: '#bdb5a6', minor_service: '#ffffff', minor_service_casing: '#cbc4b6',
    other: '#f3efe7', pedestrian: '#ece6dc', railway: '#7d7d7d',
    bridges_highway: '#f6a46b', bridges_major: '#fcd7a1', bridges_minor: '#ffffff', bridges_link: '#fcd7a1', bridges_other: '#f3efe7',
    tunnel_highway: '#f9c9a5', tunnel_major: '#fde5c4', tunnel_minor: '#f4f4f4', tunnel_link: '#fde5c4', tunnel_other: '#f4f4f4',
  };
  return {
    ...f, ...roads,
    background: '#ede8df', earth: '#f2efe9', buildings: '#d8cfc5', urban_area: '#ebe6de',
    water: '#a9d3e0', park_a: '#cdebb0', park_b: '#c3e3a6', wood_a: '#b8d9a4', wood_b: '#add19e',
    hospital: '#f6dcdc', school: '#f2e9c9', industrial: '#ebdbe8', aerodrome: '#e5e1ec',
    roads_label_minor: '#4f4a43', roads_label_minor_halo: '#ffffff', roads_label_major: '#3a352f', roads_label_major_halo: '#ffffff',
    city_label: '#1b2430', city_label_halo: '#ffffff', subplace_label: '#4f4a43', subplace_label_halo: '#ffffff',
    landcover: { ...f.landcover, urban_area: 'rgba(235, 230, 222, 1)', farmland: 'rgba(238, 240, 213, 1)', grassland: 'rgba(214, 238, 196, 1)', scrub: 'rgba(222, 236, 196, 1)', forest: 'rgba(184, 217, 164, 1)', barren: 'rgba(242, 234, 214, 1)' },
  };
})();

// The stock rules paint every road one colour. Draw roads by importance instead, each with an edge,
// so main roads read at a glance: highways dark orange, main roads light orange, streets white.
const ROAD_STYLES = [
  // [kinds, fill colour, edge colour, width stops]
  [['other', 'path'], '#ffffff', '#c9c0b0', [[14, 0], [16, 1.2], [18, 4]]],
  [['minor_road'], '#ffffff', '#b3aa99', [[11, 0], [12, 0.6], [14, 1.6], [16, 4], [18, 12]]],
  [['major_road'], '#fcd7a1', '#c08f4f', [[6, 0], [9, 0.8], [12, 2.2], [15, 4.6], [18, 15]]],
  [['highway'], '#f6a46b', '#b8652f', [[3, 0], [6, 1.2], [12, 3.2], [15, 6.5], [18, 19]]],
];
function mapPaintRules() {
  const stock = paintRules(FLAVOR).filter(rule => !(rule.dataLayer === 'roads' && rule.symbolizer?.color?.str === FLAVOR.major));
  const edges = [], fills = [];
  for (const [kinds, fill, edge, stops] of ROAD_STYLES) {
    const width = exp(1.6, stops), filter = (z, f) => kinds.includes(f.props.kind) && f.props.kind_detail !== 'pier';
    edges.push({ dataLayer: 'roads', filter, symbolizer: new LineSymbolizer({ color: edge, width: z => (z >= 12 ? width(z) + 1.6 : 0) }) });
    fills.push({ dataLayer: 'roads', filter, symbolizer: new LineSymbolizer({ color: fill, width }) });
  }
  // Keep the stock order (land, water, buildings) and insert roads where they were, edges under fills.
  const at = paintRules(FLAVOR).findIndex(rule => rule.dataLayer === 'roads' && rule.symbolizer?.color?.str === FLAVOR.major);
  return [...stock.slice(0, at), ...edges, ...fills, ...stock.slice(at)];
}

// The whole of Idoma land as one vector map file (OpenStreetMap data via Protomaps), served with the app.
// Once saved on the device every street works offline at every zoom, sharp, including places never viewed.
// Rebuild: pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles idoma-<YYYYMMDD>.pmtiles --bbox=7.45,6.55,8.75,8.2 --maxzoom=14
// and update MAP_URL. The date in the name means a saved copy never needs checking for changes.
export const MAP_URL = '/map/idoma-20261125.pmtiles';
export const MAP_BYTES = 6531223;
export const MAP_CACHE = 'lifeline-offline-map';
export const MAP_BOUNDS = [[6.55, 7.45], [8.2, 8.75]];

const createLayer = () => leafletLayer({
  url: MAP_URL, paintRules: mapPaintRules(), labelRules: labelRules(FLAVOR, 'en'), backgroundColor: FLAVOR.background,
  maxDataZoom: 14, maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Protomaps',
});
// If the map file could not be read (offline before it was saved), the layer stays blank for good. So rebuild it
// as soon as the map finishes saving or the connection returns, without the person having to reload.
export function addBaseMap(map) {
  let layer = createLayer().addTo(map), last = state.status;
  const rebuild = () => {
    if (!map.getContainer().isConnected) { stop(); window.removeEventListener('online', rebuild); return; }
    const fresh = createLayer().addTo(map);
    layer.remove(); layer = fresh;
  };
  const stop = onOfflineMapChange(next => { if (next.status === 'saved' && last !== 'saved') rebuild(); last = next.status; });
  window.addEventListener('online', rebuild);
  map.on('unload', () => { stop(); window.removeEventListener('online', rebuild); });
  return layer;
}

// ---- Saving the map on this device ----------------------------------------------------------
let state = { status: 'unknown', progress: 0 };
const listeners = new Set();
const set = next => { state = { ...state, ...next }; listeners.forEach(fn => fn(state)); };
export const offlineMapState = () => state;
export function onOfflineMapChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

async function isSaved() {
  try { return Boolean(await (await caches.open(MAP_CACHE)).match(MAP_URL)); } catch { return false; }
}

// Downloaded in 512 KB pieces, each kept as soon as it arrives, so a slow or dropped connection, a reload or a
// closed app resumes where it stopped instead of starting the 6.5 MB again. Pieces are joined once all are in.
const PART_BYTES = 512 * 1024;
const PARTS_CACHE = MAP_CACHE + '-parts';
const partKey = i => `${MAP_URL}?part=${i}`;
async function fetchPart(i, total) {
  const start = i * PART_BYTES, end = Math.min(total, start + PART_BYTES) - 1;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(MAP_URL, { headers: { Range: `bytes=${start}-${end}` }, cache: 'no-store', signal: AbortSignal.timeout(60000) });
      const bytes = await response.arrayBuffer();
      if (response.status === 206 && bytes.byteLength === end - start + 1) return bytes;
      if (response.status === 200 && bytes.byteLength === total) return { whole: bytes }; // server ignored Range
      throw new Error('Unexpected response ' + response.status);
    } catch (error) {
      if (attempt >= 3 || !navigator.onLine) throw error;
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}

let saving = null;
// Download the map file once and keep it. Data Saver is respected unless the person asks explicitly.
export function saveOfflineMap({ force = false } = {}) {
  if (saving) return saving;
  saving = (async () => {
    if (typeof caches === 'undefined') { set({ status: 'unsupported' }); return false; }
    if (await isSaved()) { set({ status: 'saved', progress: 1 }); return true; }
    if (!navigator.onLine) { set({ status: 'waiting' }); return false; }
    if (!force && navigator.connection?.saveData) { set({ status: 'datasaver' }); return false; }
    set({ status: 'saving', progress: 0 });
    try {
      const parts = await caches.open(PARTS_CACHE), total = MAP_BYTES, count = Math.ceil(total / PART_BYTES);
      const pieces = [];
      for (let i = 0; i < count; i++) {
        const kept = await parts.match(partKey(i));
        let bytes = kept ? await kept.arrayBuffer() : await fetchPart(i, total);
        if (bytes.whole) { pieces.length = 0; pieces.push(bytes.whole); break; }
        if (!kept) await parts.put(partKey(i), new Response(bytes));
        pieces.push(bytes);
        set({ progress: Math.min(0.99, (i + 1) / count) });
      }
      const blob = new Blob(pieces);
      if (blob.size !== total) throw new Error('Incomplete map file');
      const cache = await caches.open(MAP_CACHE);
      await cache.put(MAP_URL, new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }));
      await caches.delete(PARTS_CACHE);
      for (const old of await cache.keys()) if (!old.url.endsWith(MAP_URL)) await cache.delete(old);
      try { await navigator.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict it */ }
      set({ status: 'saved', progress: 1 });
      return true;
    } catch {
      set({ status: 'failed' });
      return false;
    }
  })().finally(() => { saving = null; });
  return saving;
}
if (typeof window !== 'undefined') {
  isSaved().then(saved => set({ status: saved ? 'saved' : 'missing', progress: saved ? 1 : 0 }));
  window.addEventListener('online', () => { if (state.status === 'waiting' || state.status === 'failed') saveOfflineMap(); });
}
