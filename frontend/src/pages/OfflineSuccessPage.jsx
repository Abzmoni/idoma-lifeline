import { useNavigate, useSearchParams } from 'react-router-dom';
import MapIcon from '../components/MapIcon';
import { useI18n } from '../i18n';
import '../report.css';

export default function OfflineSuccessPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [params] = useSearchParams();
  const sent = params.get('sent') === '1';

  return <div className="report-flow report-done">
    <section className="report-step" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 64 }}>
      <span className="report-type-icon" style={{ background: sent ? '#1f8a78' : '#e8600c', width: 96, height: 96, borderRadius: 48 }}><MapIcon name="check" /></span>
      <h1>{t(sent ? 'done.sentTitle' : 'done.savedTitle')}</h1>
      <p className="report-hint" style={{ fontSize: 18, maxWidth: 340 }}>{t(sent ? 'done.sentBody' : 'done.savedBody')}</p>
      <button type="button" className="report-primary" style={{ width: '100%', marginTop: 24 }} onClick={() => navigate('/')}><MapIcon name="map" />{t('done.back')}</button>
      <button type="button" className="report-secondary" style={{ width: '100%' }} onClick={() => navigate('/report')}>{t('done.another')}</button>
    </section>
  </div>;
}
