import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const empty = {
  title: '', description: '', country: 'Turkey', city: '', town: '',
  workingType: 'fulltime', seniority: 'mid', requirements: '', companyName: '',
};

export default function Admin() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.adminListJobs().then((r) => setJobs(r.data)).catch(() => setJobs([]));
  useEffect(() => { load(); }, []);

  if (!user || (user.role !== 'admin' && user.role !== 'company')) {
    return <div className="card">Bu sayfa sadece admin/firma kullanıcıları içindir.</div>;
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    const payload = {
      ...form,
      requirements: form.requirements ? form.requirements.split('\n').filter(Boolean) : [],
    };
    try {
      if (editingId) await api.adminUpdateJob(editingId, payload);
      else await api.adminCreateJob(payload);
      setForm(empty);
      setEditingId(null);
      setMsg('Kaydedildi.');
      load();
    } catch (err) {
      setMsg('Hata: ' + err.message);
    }
  };

  const edit = (j) => {
    setForm({
      title: j.title, description: j.description, country: j.country,
      city: j.city, town: j.town || '', workingType: j.working_type,
      seniority: j.seniority, requirements: (j.requirements || []).join('\n'),
      companyName: j.company_name || '',
    });
    setEditingId(j.id);
  };

  const del = async (id) => {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    await api.adminDeleteJob(id);
    load();
  };

  return (
    <>
      <div className="card">
        <h2>{editingId ? 'İlanı Güncelle' : 'Yeni İlan Ekle'}</h2>
        <form onSubmit={save}>
          <div className="row">
            <div className="col">
              <label>Başlık</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div className="col">
              <label>Firma Adı</label>
              <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="col"><label>Ülke</label><input value={form.country} onChange={(e) => set('country', e.target.value)} style={{ width: '100%' }} /></div>
            <div className="col"><label>Şehir</label><input value={form.city} onChange={(e) => set('city', e.target.value)} required style={{ width: '100%' }} /></div>
            <div className="col"><label>İlçe</label><input value={form.town} onChange={(e) => set('town', e.target.value)} style={{ width: '100%' }} /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="col">
              <label>Çalışma Tipi</label>
              <select value={form.workingType} onChange={(e) => set('workingType', e.target.value)} style={{ width: '100%' }}>
                <option value="fulltime">Tam Zamanlı</option>
                <option value="parttime">Yarı Zamanlı</option>
                <option value="remote">Uzaktan</option>
                <option value="hybrid">Hibrit</option>
                <option value="internship">Staj</option>
              </select>
            </div>
            <div className="col">
              <label>Seviye</label>
              <select value={form.seniority} onChange={(e) => set('seniority', e.target.value)} style={{ width: '100%' }}>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Açıklama</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} required rows={4} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <label>Gereksinimler (her satırda bir tane)</label>
            <textarea value={form.requirements} onChange={(e) => set('requirements', e.target.value)} rows={3} style={{ width: '100%' }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="submit">{editingId ? 'Güncelle' : 'Oluştur'}</button>
            {editingId && (
              <button type="button" className="secondary" style={{ marginLeft: 8 }} onClick={() => { setForm(empty); setEditingId(null); }}>İptal</button>
            )}
            {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Mevcut İlanlar</h3>
        {jobs.map((j) => (
          <div key={j.id} className="job">
            <h3>{j.title}</h3>
            <div className="muted">{j.company_name} — {j.city} / {j.country}</div>
            <div className="badges">
              <span className="tag">{j.working_type}</span>
              <span className="tag">{j.seniority}</span>
              <span className="tag">{j.is_active ? 'Aktif' : 'Pasif'}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="secondary" onClick={() => edit(j)}>Düzenle</button>
              <button style={{ marginLeft: 8, background: '#c0392b', borderColor: '#c0392b' }} onClick={() => del(j.id)}>Sil</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
