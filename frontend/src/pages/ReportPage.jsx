import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { api } from '../api';
import MapIcon, { iconMarkup } from '../components/MapIcon';
import Signal from '../components/Signal';
import { useI18n } from '../i18n';
import { quickLocate, lastKnownLocation, accuracyLabel, ageParts, validPoint, USABLE_LOCATION_METERS } from '../location';
import '../report.css';

// Three short steps for people under stress: what → where → (optional) details.
// Location is found automatically: fresh GPS (works without data) → last known location on this phone → tap the map / choose a town.
const TYPES = [
  ['shelter', '#92502d'], ['water', '#166681'], ['medical', '#b73333'],
  ['food', '#906917'], ['safe_zone', '#177767'], ['hazard', '#b73333'],
];
const TOWNS = [
  ['Otukpo', 7.1904, 8.1345], ['Otukpo market', 7.193, 8.138], ['Adoka', 7.161, 7.93], ['Ugbokolo', 6.985, 7.98],
  ['Okpoga', 7.05, 7.8], ['Otukpa', 7.1, 7.65], ['Igumale', 6.8, 7.9667], ['Oju', 6.85, 8.4167],
  ['Obarike-Ito', 7.0167, 8.3333], ['Idekpa', 7.38, 8.0], ['Ugbokpo (Apa)', 7.65, 7.9], ['Obagaji (Agatu)', 7.93, 7.87],
];
const DEFAULT_CENTRE = [7.1904, 8.1345];

export default function ReportPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [place, setPlace] = useState(null); // { lat, lng, source: 'gps'|'last'|'map'|'town', accuracy?, at?, town? }
  const [finding, setFinding] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [publicContact, setPublicContact] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const mapNode = useRef(null), map = useRef(null), marker = useRef(null), userMoved = useRef(false);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const findMe = async () => {
    setFinding(true);
    try {
      const point = await quickLocate();
      if (!userMoved.current && point.accuracy <= USABLE_LOCATION_METERS) setPlace({ ...point, source: 'gps' });
      else if (!userMoved.current) throw new Error('imprecise');
    } catch {
      const last = lastKnownLocation();
      if (!userMoved.current && last) setPlace({ ...last, source: 'last' });
    } finally { setFinding(false); }
  };
  // Start looking as soon as the page opens, so the pin is ready by step 2.
  useEffect(() => { findMe(); }, []);

  // The map exists only on step 2.
  useEffect(() => {
    if (step !== 2 || !mapNode.current) return;
    const instance = L.map(mapNode.current, { zoomControl: true }).setView(DEFAULT_CENTRE, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(instance);
    const color = (TYPES.find(([id]) => id === type) || TYPES[0])[1];
    const icon = L.divIcon({ className: 'resource-pin report-pin', html: `<span style="background:${color}">${iconMarkup(type || 'pin')}</span><i style="border-top-color:${color}"></i>`, iconSize: [44, 54], iconAnchor: [22, 54] });
    const moveTo = (lat, lng) => { userMoved.current = true; setPlace({ lat, lng, source: 'map' }); };
    marker.current = L.marker(DEFAULT_CENTRE, { draggable: true, icon, opacity: 0 }).addTo(instance);
    marker.current.on('dragend', () => { const p = marker.current.getLatLng(); moveTo(p.lat, p.lng); });
    instance.on('click', e => moveTo(e.latlng.lat, e.latlng.lng));
    map.current = instance;
    return () => { instance.remove(); map.current = null; marker.current = null; };
  }, [step, type]);

  // Keep the pin and view in step with the chosen place.
  useEffect(() => {
    if (!map.current || !marker.current) return;
    if (!place) { marker.current.setOpacity(0); return; }
    marker.current.setOpacity(1).setLatLng([place.lat, place.lng]);
    if (place.source !== 'map') map.current.setView([place.lat, place.lng], navigator.onLine ? (place.source === 'town' ? 14 : 16) : 13, { animate: false });
  }, [place, step]);

  const chooseType = id => { setType(id); setStep(2); };
  const chooseTown = value => {
    const town = TOWNS.find(([label]) => label === value);
    if (!town) return;
    userMoved.current = true;
    setPlace({ lat: town[1], lng: town[2], source: 'town', town: town[0] });
  };
  const ago = at => { const a = ageParts(at); return `${a.n} ${t('unit.' + a.unit)}`; };
  const status = finding && !place ? t('loc.finding')
    : !place ? t('loc.none')
    : place.source === 'gps' ? t('loc.gps', { acc: accuracyLabel(place.accuracy) })
    : place.source === 'last' ? t('loc.last', { age: ago(place.at) })
    : place.source === 'town' ? t('loc.town', { town: place.town })
    : t('loc.map');
  const where = !place ? '' : place.source === 'town' ? t('report.where.town', { town: place.town }) : t('report.where.' + place.source);

  const submit = async e => {
    e.preventDefault();
    if (!type || !place || !validPoint(place)) { setStep(!type ? 1 : 2); return; }
    setSending(true); setError('');
    // Tell coordinators how the location was found so they can judge its accuracy.
    const locationNote = place.source === 'gps' ? `Location: phone GPS, about ${accuracyLabel(place.accuracy)}`
      : place.source === 'last' ? `Location: last known position, ${ago(place.at)} old`
      : place.source === 'town' ? `Location: town chosen (${place.town})` : 'Location: pin placed on map';
    try {
      const res = await api.submitReport({
        type,
        name: name.trim() || t('report.autoName', { type: t('rtype.' + type) }),
        description: [description.trim(), `(${locationNote})`].filter(Boolean).join(' '),
        location: { lat: place.lat, lng: place.lng },
        reporter_contact: reporterContact.trim(),
        public_contact: publicContact.trim(),
        source: 'app',
      });
      navigate(res.offline ? '/offline-success' : '/offline-success?sent=1');
    } catch (err) {
      setError(err.message || t('report.error'));
    } finally { setSending(false); }
  };

  const back = () => (step === 1 ? navigate('/') : setStep(step - 1));

  return <div className="report-flow">
    <header className="report-top">
      <button type="button" className="report-back" onClick={back} aria-label={t('report.back')}><MapIcon name="back" /></button>
      <div><strong>{t('report.title')}</strong><span>{t('report.step', { n: step })}</span></div>
      {offline && <Signal state="offline" label={t('status.offline')} />}
    </header>
    <div className="report-progress" aria-hidden="true">{[1, 2, 3].map(n => <i key={n} className={n <= step ? 'on' : ''} />)}</div>

    {step === 1 && <section className="report-step">
      <h1>{t('report.q1')}</h1>
      <p className="report-hint">{t('report.q1hint')}</p>
      <div className="report-types">
        {TYPES.map(([id, color]) => <button key={id} type="button" className={type === id ? 'chosen' : ''} onClick={() => chooseType(id)}>
          <span className="report-type-icon" style={{ background: color }}><MapIcon name={id} /></span>{t('rtype.' + id)}
        </button>)}
      </div>
    </section>}

    {step === 2 && <section className="report-step">
      <h1>{t('report.q2')}</h1>
      <p className={'report-status ' + (place ? 'ok' : finding ? '' : 'warn')} role="status"><MapIcon name={place ? 'pin' : 'location'} />{status}</p>
      <div ref={mapNode} className="report-map" aria-label={t('loc.adjust')} />
      <p className="report-hint">{t('loc.adjust')}</p>
      <div className="report-row">
        <select aria-label={t('loc.townChoose')} value={place?.source === 'town' ? place.town : ''} onChange={e => chooseTown(e.target.value)}>
          <option value="">{t('loc.townChoose')}</option>
          {TOWNS.map(([label]) => <option key={label} value={label}>{label}</option>)}
        </select>
        <button type="button" className="report-secondary" disabled={finding} onClick={() => { userMoved.current = false; findMe(); }}>
          <MapIcon name="location" />{finding ? t('loc.finding') : t('loc.retry')}
        </button>
      </div>
      <button type="button" className="report-primary" disabled={!place} onClick={() => setStep(3)}><MapIcon name="check" />{t('report.here')}</button>
    </section>}

    {step === 3 && <form className="report-step" onSubmit={submit}>
      <h1>{t('report.q3')}</h1>
      <p className="report-summary"><span className="report-type-icon small" style={{ background: (TYPES.find(([id]) => id === type) || TYPES[0])[1] }}><MapIcon name={type} /></span>{t('rtype.' + type)} · {where}</p>
      <p className="report-hint">{t('report.optional')}</p>
      {error && <p className="report-status warn" role="alert">{error}</p>}
      <label>{t('report.name')}<input value={name} onChange={e => setName(e.target.value)} placeholder={t('report.namePh')} maxLength={180} /></label>
      <label>{t('report.desc')}<textarea rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('report.descPh')} maxLength={2800} /></label>
      <label>{t('report.phone')}<input type="tel" inputMode="tel" value={reporterContact} onChange={e => setReporterContact(e.target.value)} placeholder="080…" maxLength={60} />
        <small><MapIcon name="lock" />{t('report.phoneNote')}</small></label>
      <details className="report-more"><summary>{t('report.more')}</summary>
        <label>{t('report.publicPhone')}<input type="tel" inputMode="tel" value={publicContact} onChange={e => setPublicContact(e.target.value)} pattern="[+0-9 ()-]{5,25}" /><small>{t('report.publicNote')}</small></label>
      </details>
      {offline && <p className="report-status">{t('report.saveNote')}</p>}
      <button type="submit" className="report-primary" disabled={sending}>{sending ? t('report.sending') : t(offline ? 'report.save' : 'report.send')}</button>
    </form>}
  </div>;
}
