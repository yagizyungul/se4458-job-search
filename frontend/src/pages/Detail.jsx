import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Detail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [related, setRelated] = useState([]);
  const [msg, setMsg] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.jobDetail(id).then(setJob).catch(() => setJob(null));
    api.related(id).then((r) => setRelated(r.data || []));
  }, [id]);

  const apply = async () => {
    if (!user) { navigate('/login?redirect=/jobs/' + id); return; }
    try {
      await api.apply(id);
      setMsg('Başvurunuz alındı!');
      api.jobDetail(id).then(setJob);
    } catch (err) {
      setMsg(err.message);
    }
  };

  if (!job) return <div className="card">Yükleniyor...</div>;

  return (
    <div className="layout">
      <main>
        <div className="card">
          <h2>{job.title}</h2>
          <div className="muted">{job.company_name}</div>
          <div className="muted">{[job.town, job.city, job.country].filter(Boolean).join(', ')}</div>
          <div className="badges" style={{ marginTop: 10 }}>
            <span className="tag">{job.working_type}</span>
            <span className="tag">{job.seniority}</span>
          </div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
          {Array.isArray(job.requirements) && job.requirements.length > 0 && (
            <>
              <h4>Gereksinimler</h4>
              <ul>{job.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
          <div className="muted">
            Son güncelleme: {new Date(job.last_updated).toLocaleString('tr-TR')} ·
            Başvuru sayısı: {job.application_count}
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={apply}>Başvur</button>
            {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
          </div>
        </div>
      </main>
      <aside style={{ width: 280 }}>
        <div className="card">
          <h3>İlgilenebileceğiniz İlanlar</h3>
          {related.length === 0 ? (
            <div className="muted">İlgili ilan bulunamadı.</div>
          ) : related.map((r) => (
            <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
              <Link to={`/jobs/${r.id}`}>{r.title}</Link>
              <div className="muted">{r.company_name} — {r.city}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
