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
  'view.list': 'List view', 'view.map': 'Map view', 'hint': 'Tap what you need to see the nearest help.',
  'list.heading': 'Find local help', 'close': 'Close', 'list.search': 'Search resources', 'list.placeholder': 'Name or landmark',
  'list.distances': 'Distances are straight-line estimates from {origin}.', 'list.yourPin': 'your location',
  'list.none': 'No matching resources available. Try another category.',
  'list.noneOffline': 'No matching resources saved on this device. Try another category.',
  'list.noDistance': 'Distance unavailable', 'list.verified': 'Verified {date}',
  'fresh.stale': 'May be outdated', 'fresh.staleNote': 'Not re-checked for over 3 days. Call ahead before you travel.',
  'details.verified': 'Verified report', 'details.distance': '{km} km from {origin} · straight line',
  'details.lastVerified': 'Last verified {date}', 'details.noDetails': 'No additional details available.',
  'details.capacity': 'Total capacity:', 'details.spacesUnknown': 'Available spaces unknown',
  'details.coordinates': 'Location coordinates', 'details.directions': 'Directions', 'details.call': 'Call facility',
  'route.finding': 'Finding the way…', 'route.road': 'Road route · {km} km', 'route.saved': 'Saved road route · {km} km',
  'route.straight': 'Go {dir} · {km} km', 'route.walk': 'About {time} on foot.', 'route.from': '{from} → {to}',
  'route.savedNote': 'No internet, so this is a route saved on this phone {age} ago. Roads and dangers may have changed.',
  'route.savedGap': 'It starts {m} from you. Go to the start of the blue line first.',
  'route.straightNote': 'No internet for road directions. The dotted line shows the direction, not the road. Follow roads going {dir} and ask people nearby.',
  'route.danger': '{n} reported danger(s) near this way. Do not assume it is safe. Call ahead or ask locally.',
  'route.clear': 'No reported dangers near this way. Things change, so ask locally before you go.',
  'route.avoided': 'Went around {n} reported danger(s).', 'route.close': 'Close route',
  'map.saved': 'Offline map saved ({mb} MB). Every street in Idoma land works with no internet.', 'map.saving': 'Saving the offline map… {pct}%', 'map.save': 'Save offline map ({mb} MB)', 'strip.mapMissing': 'Street map not saved yet: it saves the next time you are online.',
  'loc.far': 'Your device gave a location far from Idoma land, so we did not use it. This often happens on a laptop using a phone hotspot. For the right location, open this app on the phone itself.',
  'route.far': 'Your device gave a location far from Idoma land, so we did not use it (this often happens on a laptop using a phone hotspot). This route starts at Otukpo town centre.',
  'route.fromGuess': 'We could not find your location, so this starts at Otukpo town centre.',
  'route.youLast': 'Your last known location', 'route.you': 'Your location', 'route.justNow': 'a moment',
  'dir.n': 'north', 'dir.ne': 'north-east', 'dir.e': 'east', 'dir.se': 'south-east', 'dir.s': 'south', 'dir.sw': 'south-west', 'dir.w': 'west', 'dir.nw': 'north-west',
  'unit.mins': '{n} min', 'unit.hours': '{n} h',
  'notice.synced': 'Report synced · Awaiting coordinator review',
  'notice.noneSynced': 'No reports synced. Any waiting reports remain safely on this device.',
  'notice.syncFailed': 'Sync unavailable. Your saved reports remain on this device.',
  'notice.readFailed': 'Saved information could not be read. Please refresh.',
  'notice.dismiss': 'Dismiss notification', 'demo.label': 'Demo data', 'time.unavailable': 'Time unavailable',
  'report.title': 'Report something', 'report.step': 'Step {n} of 3', 'report.back': 'Back',
  'report.q1': 'What do you want to report?', 'report.q1hint': 'Tap one.',
  'rtype.shelter': 'Shelter', 'rtype.water': 'Water', 'rtype.medical': 'Medical help', 'rtype.food': 'Food',
  'rtype.safe_zone': 'Safe place', 'rtype.hazard': 'Danger',
  'report.q2': 'Where is it?', 'loc.finding': 'Finding your location…',
  'loc.gps': 'The pin is on your location (about {acc}).',
  'loc.last': 'No fresh signal. The pin is on your last known location ({age} ago).',
  'loc.none': "We couldn't find your location. Tap the map where it is, or choose a town below.",
  'loc.map': 'Pin moved by you.', 'loc.town': 'Pin placed at {town}.',
  'loc.adjust': 'Not exactly here? Drag the pin or tap the map.', 'loc.townChoose': 'Or choose a town',
  'loc.retry': 'Find my location', 'report.here': "Yes, it's here",
  'report.q3': 'Anything to add?', 'report.optional': 'Everything here is optional. You can send now.',
  'report.name': 'Name of the place', 'report.namePh': "e.g. St. Mary's Church hall",
  'report.desc': "What's happening there?", 'report.descPh': 'e.g. Open now, room for about 50 people',
  'report.phone': 'Your phone number (private)', 'report.phoneNote': 'Only coordinators see this, so they can call you back.',
  'report.more': 'Add a public phone for this place', 'report.publicPhone': 'Public phone for the place',
  'report.publicNote': 'Shown on the map after review. Only use a number that may be called publicly.',
  'report.send': 'Send report', 'report.save': 'Save report', 'report.sending': 'Sending…',
  'report.saveNote': "No connection. We'll keep it on this phone and send it by itself when you're back online.",
  'report.where.gps': 'at your location', 'report.where.last': 'at your last known location',
  'report.where.map': 'where you put the pin', 'report.where.town': 'near {town}',
  'report.autoName': '{type} (community report)', 'report.error': 'Could not save your report. Please try again.',
  'unit.min': 'min', 'unit.h': 'h', 'unit.d': 'days',
  'done.savedTitle': 'Saved on this device.', 'done.savedBody': "It will send by itself when you're back online. You can close the app.",
  'done.sentTitle': 'Report received.', 'done.sentBody': 'Thank you. A local coordinator will check it, then it appears on the map.',
  'done.back': 'Back to map', 'done.another': 'Report something else',
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
  'view.list': 'See list', 'view.map': 'See map', 'hint': 'Touch wetin you need to see the one wey near you.',
  'list.heading': 'Find help near you', 'close': 'Close', 'list.search': 'Search', 'list.placeholder': 'Name or place',
  'list.distances': 'Distance na straight line from {origin}.', 'list.yourPin': 'where you dey',
  'list.none': 'Nothing match. Try another category.',
  'list.noneOffline': 'Nothing match for this phone. Try another category.',
  'list.noDistance': 'We no know the distance', 'list.verified': 'Dem check am {date}',
  'fresh.stale': 'E fit don change', 'fresh.staleNote': 'Dem never check am again for over 3 days. Call dem before you waka go.',
  'details.verified': 'Dem don check am', 'details.distance': '{km} km from {origin} · straight line',
  'details.lastVerified': 'Last check: {date}', 'details.noDetails': 'No more details.',
  'details.capacity': 'How many people e fit hold:', 'details.spacesUnknown': 'We no know how many space remain',
  'details.coordinates': 'Location coordinates', 'details.directions': 'Road', 'details.call': 'Call dem',
  'route.finding': 'We dey find road…', 'route.road': 'Road · {km} km', 'route.saved': 'Road wey dey this phone · {km} km',
  'route.straight': 'Go {dir} · {km} km', 'route.walk': 'Like {time} if you waka.', 'route.from': '{from} → {to}',
  'route.savedNote': 'Network no dey, so na road wey this phone save {age} ago. Road and wahala fit don change.',
  'route.savedGap': 'E start {m} from where you dey. First go where the blue line start.',
  'route.straightNote': 'Network no dey to show road. The dotted line na direction, no be road. Follow road wey dey go {dir}, ask people for there.',
  'route.danger': 'Dem report {n} danger near this way. No think say e safe. Call first or ask people.',
  'route.clear': 'Nobody report danger near this way. Things fit change, ask people before you go.',
  'route.avoided': 'We pass round {n} danger wey dem report.', 'route.close': 'Close road',
  'map.saved': 'Offline map don save ({mb} MB). All road for Idoma land go show even without network.', 'map.saving': 'We dey save offline map… {pct}%', 'map.save': 'Save offline map ({mb} MB)', 'strip.mapMissing': 'Street map never save yet: e go save next time network dey.',
  'loc.far': 'Your device talk say you dey far from Idoma land, so we no use am. E dey happen when laptop dey use phone hotspot. To get correct place, open this app for the phone itself.',
  'route.far': 'Your device talk say you dey far from Idoma land, so we no use am (e dey happen when laptop dey use phone hotspot). This road start from Otukpo town centre.',
  'route.fromGuess': 'We no fit find where you dey, so we start am from Otukpo town centre.',
  'route.youLast': 'Where you dey last', 'route.you': 'Where you dey', 'route.justNow': 'small time',
  'dir.n': 'north', 'dir.ne': 'north-east', 'dir.e': 'east', 'dir.se': 'south-east', 'dir.s': 'south', 'dir.sw': 'south-west', 'dir.w': 'west', 'dir.nw': 'north-west',
  'unit.mins': '{n} min', 'unit.hours': '{n} hour',
  'notice.synced': 'Report don send · Coordinator go check am',
  'notice.noneSynced': 'No report send. Any report wey dey wait still dey safe for this phone.',
  'notice.syncFailed': 'We no fit send now. Your saved reports still dey this phone.',
  'notice.readFailed': 'We no fit read saved information. Abeg refresh.',
  'notice.dismiss': 'Close message', 'demo.label': 'Demo data', 'time.unavailable': 'No time',
  'report.title': 'Report something', 'report.step': 'Step {n} of 3', 'report.back': 'Go back',
  'report.q1': 'Wetin you wan report?', 'report.q1hint': 'Touch one.',
  'rtype.shelter': 'Place to stay', 'rtype.water': 'Water', 'rtype.medical': 'Hospital', 'rtype.food': 'Food',
  'rtype.safe_zone': 'Safe place', 'rtype.hazard': 'Danger',
  'report.q2': 'Where e dey?', 'loc.finding': 'We dey find where you dey…',
  'loc.gps': 'The pin dey where you dey (about {acc}).',
  'loc.last': 'No signal now. The pin dey the last place we see you ({age} ago).',
  'loc.none': 'We no fit find where you dey. Touch the map where e dey, or choose town for down.',
  'loc.map': 'You don move the pin.', 'loc.town': 'Pin dey {town}.',
  'loc.adjust': 'E no dey exactly here? Drag the pin or touch the map.', 'loc.townChoose': 'Or choose town',
  'loc.retry': 'Find where I dey', 'report.here': 'Yes, e dey here',
  'report.q3': 'Anything to add?', 'report.optional': 'You no must fill anything here. You fit send now.',
  'report.name': 'Name of the place', 'report.namePh': "e.g. St. Mary's Church hall",
  'report.desc': 'Wetin dey happen there?', 'report.descPh': 'e.g. E open now, space for like 50 people',
  'report.phone': 'Your phone number (private)', 'report.phoneNote': 'Na only coordinators go see am, so dem fit call you.',
  'report.more': 'Add public phone for this place', 'report.publicPhone': 'Public phone for the place',
  'report.publicNote': 'E go show for map after dem check am. Use only number wey people fit call.',
  'report.send': 'Send report', 'report.save': 'Keep report', 'report.sending': 'E dey send…',
  'report.saveNote': 'No network. We go keep am for this phone, e go send by itself when network come back.',
  'report.where.gps': 'for where you dey', 'report.where.last': 'for the last place we see you',
  'report.where.map': 'where you put the pin', 'report.where.town': 'near {town}',
  'report.autoName': '{type} (community report)', 'report.error': 'We no fit keep your report. Abeg try again.',
  'unit.min': 'min', 'unit.h': 'hours', 'unit.d': 'days',
  'done.savedTitle': 'E dey this phone.', 'done.savedBody': 'E go send by itself when network come back. You fit close the app.',
  'done.sentTitle': 'We don receive am.', 'done.sentBody': 'Thank you. Coordinator go check am, then e go show for map.',
  'done.back': 'Go back to map', 'done.another': 'Report another thing',
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
