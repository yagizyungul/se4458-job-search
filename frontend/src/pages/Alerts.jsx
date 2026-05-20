import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const empty = { position: '', city: '', country: '', workingType: '' };

export default function Alerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');

  const load = () => api.listAlerts().then((r) => setAlerts(r.data)).catch(() => setAlerts([]));
  useEffect(() => { if (user) load(); }, [user]);

  if (!user) return <div className="card">Giriş yapmanız gerekir.</div>;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createAlert(form);
      setForm(empty);
      setMsg('Alarm oluşturuldu.');
      load();
    } catch (err) { setMsg('Hata: ' + err.message); }
  };

  const remove = async (id) => {
    await api.deleteAlert(id);
    load();
  };

  return (
    <>
      <div className="card">
        <h2>İş Alarmı (Iş Alarmı)</h2>
        <p className="muted">Belirlediğiniz kriterlere uygun yeni ilan açıldığında bildirim alırsınız.</p>
        <form onSubmit={submit}>
          <div className="row">
            <div className="col"><label>Pozisyon</label><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} style={{ width: '100%' }} /></div>
            <div className="col"><label>Şehir</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%' }} /></div>
            <div className="col">
              <label>Çalışma</label>
              <select value={form.workingType} onChange={(e) => setForm({ ...form, workingType: e.target.value })} style={{ width: '100%' }}>
                <option value="">Tümü</option>
                <option value="fulltime">Tam Zamanlı</option>
                <option value="remote">Uzaktan</option>
                <option value="hybrid">Hibrit</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="submit">Alarm Oluştur</button>
            {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Mevcut Alarmlarım</h3>
        {alerts.length === 0 ? (
          <div className="muted">Tanımlı alarm yok.</div>
        ) : alerts.map((a) => (
          <div key={a._id} className="job">
            <div>
              <strong>{a.criteria.position || 'Tümü'}</strong> – {a.criteria.city || 'Tüm şehirler'}
              {a.criteria.workingType && <span className="tag" style={{ marginLeft: 8 }}>{a.criteria.workingType}</span>}
            </div>
            <button style={{ marginTop: 6, background: '#c0392b', borderColor: '#c0392b' }} onClick={() => remove(a._id)}>Sil</button>
          </div>
        ))}
      </div>
    </>
  );
}
