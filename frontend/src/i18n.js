import { useSyncExternalStore } from 'react';

// Interface strings for the public map. English is the source of truth; every other
// language falls back to English key by key, so a partial translation never shows a blank.
const EN = {
  'status.offline': 'Offline', 'status.saved': 'Saved data', 'status.online': 'Online',
  'nav.directions': 'Directions', 'nav.coordinator': 'Coordinator', 'nav.more': 'More options',
  'nav.map': 'Map', 'nav.report': 'Report', 'nav.language': 'Language',
  'menu.title': 'Map options', 'menu.updated': 'Updated {date}', 'menu.waiting': 'Waiting for resource information',
  'menu.demo': 'Otukpo demo', 'menu.pin': 'Place a pin', 'menu.sync': 'Sync now', 'menu.syncing': 'Syncing…',
  'menu.prototype': 'Prototype · Sample data', 'menu.simulated': 'SMS/USSD simulated',
  'strip.offline': 'Offline · Saved information', 'strip.cached': 'Using saved information',
  'strip.pendingOne': '{n} report waiting to sync', 'strip.pendingMany': '{n} reports waiting to sync',
  'strip.queueError': 'A saved report needs correction: {error}',
  'find.heading': 'What do you need?', 'filter.all': 'All',
  'type.shelter': 'Shelter', 'type.water': 'Water', 'type.medical': 'Medical', 'type.food': 'Food',
  'type.safe_zone': 'Safe zones', 'type.hazard': 'Hazards',
  'view.list': 'List view', 'view.map': 'Map view', 'hint': 'Choose a category or tap a pin to find help.',
  'list.heading': 'Find local help', 'close': 'Close', 'list.search': 'Search resources', 'list.placeholder': 'Name or landmark',
  'list.distances': 'Distances are straight-line estimates from {origin}.', 'list.yourPin': 'your confirmed pin',
  'list.none': 'No matching resources available. Try another category.',
  'list.noneOffline': 'No matching resources saved on this device. Try another category.',
  'list.noDistance': 'Distance unavailable', 'list.verified': 'Verified {date}',
  'fresh.stale': 'May be outdated', 'fresh.staleNote': 'Not re-checked for over 3 days. Call ahead before you travel.',
  'details.verified': 'Verified report', 'details.distance': '{km} km from {origin} · straight line',
  'details.lastVerified': 'Last verified {date}', 'details.noDetails': 'No additional details available.',
  'details.capacity': 'Total capacity:', 'details.spacesUnknown': 'Available spaces unknown',
  'details.coordinates': 'Location coordinates', 'details.directions': 'Directions', 'details.call': 'Call facility',
  'notice.synced': 'Report synced · Awaiting coordinator review',
  'notice.noneSynced': 'No reports synced. Any waiting reports remain safely on this device.',
  'notice.syncFailed': 'Sync unavailable. Your saved reports remain on this device.',
  'notice.readFailed': 'Saved information could not be read. Please refresh.',
  'notice.dismiss': 'Dismiss notification', 'demo.label': 'Demo data', 'time.unavailable': 'Time unavailable',
};

// Nigerian Pidgin. Have a fluent speaker review wording before field use.
const PCM = {
  'status.offline': 'No network', 'status.saved': 'Saved data', 'status.online': 'Online',
  'nav.directions': 'Road', 'nav.coordinator': 'Coordinator', 'nav.more': 'More options',
  'nav.map': 'Map', 'nav.report': 'Report', 'nav.language': 'Language',
  'menu.title': 'Map options', 'menu.updated': 'Last update {date}', 'menu.waiting': 'We dey wait for information',
  'menu.demo': 'Otukpo demo', 'menu.pin': 'Put pin', 'menu.sync': 'Send now', 'menu.syncing': 'E dey send…',
  'menu.prototype': 'Prototype · Sample data', 'menu.simulated': 'SMS/USSD na simulation',
  'strip.offline': 'No network · Saved information', 'strip.cached': 'Na saved information we dey use',
  'strip.pendingOne': '{n} report dey wait to send', 'strip.pendingMany': '{n} reports dey wait to send',
  'strip.queueError': 'One saved report need correction: {error}',
  'find.heading': 'Wetin you need?', 'filter.all': 'All',
  'type.shelter': 'Place to stay', 'type.water': 'Water', 'type.medical': 'Hospital', 'type.food': 'Food',
  'type.safe_zone': 'Safe place', 'type.hazard': 'Danger',
  'view.list': 'See list', 'view.map': 'See map', 'hint': 'Choose wetin you need or touch pin to find help.',
  'list.heading': 'Find help near you', 'close': 'Close', 'list.search': 'Search', 'list.placeholder': 'Name or place',
  'list.distances': 'Distance na straight line from {origin}.', 'list.yourPin': 'your pin',
  'list.none': 'Nothing match. Try another category.',
  'list.noneOffline': 'Nothing match for this phone. Try another category.',
  'list.noDistance': 'We no know the distance', 'list.verified': 'Dem check am {date}',
  'fresh.stale': 'E fit don change', 'fresh.staleNote': 'Dem never check am again for over 3 days. Call dem before you waka go.',
  'details.verified': 'Dem don check am', 'details.distance': '{km} km from {origin} · straight line',
  'details.lastVerified': 'Last check: {date}', 'details.noDetails': 'No more details.',
  'details.capacity': 'How many people e fit hold:', 'details.spacesUnknown': 'We no know how many space remain',
  'details.coordinates': 'Location coordinates', 'details.directions': 'Road', 'details.call': 'Call dem',
  'notice.synced': 'Report don send · Coordinator go check am',
  'notice.noneSynced': 'No report send. Any report wey dey wait still dey safe for this phone.',
  'notice.syncFailed': 'We no fit send now. Your saved reports still dey this phone.',
  'notice.readFailed': 'We no fit read saved information. Abeg refresh.',
  'notice.dismiss': 'Close message', 'demo.label': 'Demo data', 'time.unavailable': 'No time',
};

// Idoma: for the team's native speakers to fill in, using the same keys as EN above.
// The Idoma option appears in the language menu automatically once 80% of keys are translated,
// so an untranslated or half-translated version never appears on stage.
const IDU = {};

const DICTS = { en: EN, pcm: PCM, idu: IDU };
const TOTAL = Object.keys(EN).length;
export const LANGUAGES = [['en', 'English', 'EN'], ['pcm', 'Pidgin', 'PCM'], ['idu', 'Idoma', 'IDU']]
  .filter(([code]) => code === 'en' || Object.keys(DICTS[code]).length >= TOTAL * 0.8);

const STORAGE_KEY = 'lifeline-language';
let current = 'en';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (LANGUAGES.some(([code]) => code === saved)) current = saved;
} catch { /* storage unavailable: English */ }
const listeners = new Set();

export function setLanguage(code) {
  if (!LANGUAGES.some(([c]) => c === code)) return;
  current = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* per-device convenience only */ }
  document.documentElement.lang = code;
  listeners.forEach(listener => listener());
}

export function translate(key, vars = {}, lang = current) {
  const text = DICTS[lang]?.[key] ?? EN[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export function useI18n() {
  const lang = useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current
  );
  return { lang, setLanguage, t: (key, vars) => translate(key, vars, lang) };
}
