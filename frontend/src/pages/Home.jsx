import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import JobCard from '../components/JobCard.jsx';

const DEFAULT_CITY = 'Istanbul';

export default function Home() {
  const [position, setPosition] = useState('');
  const [city, setCity] = useState(DEFAULT_CITY);
  const [jobs, setJobs] = useState([]);
  const [recent, setRecent] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { /* would reverse geocode here */ },
        () => {},
        { timeout: 1500 },
      );
    }
  }, []);

  useEffect(() => {
    api.homeJobs(city, 5).then((r) => setJobs(r.data)).catch(() => setJobs([]));
  }, [city]);

  useEffect(() => {
    if (!user) { setRecent([]); return; }
    api.recentSearches().then((r) => setRecent(r.data || [])).catch(() => setRecent([]));
  }, [user]);

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (position) params.set('position', position);
    if (city) params.set('city', city);
    navigate(`/search?${params}`);
  };

  return (
    <>
      <div className="card">
        <h2>İş Ara</h2>
        <form onSubmit={submit}>
          <div className="row">
            <div className="col">
              <label>Pozisyon</label>
              <Autocomplete type="position" value={position} onChange={setPosition} placeholder="Örn: Web Developer" />
            </div>
            <div className="col">
              <label>Şehir</label>
              <Autocomplete type="city" value={city} onChange={setCity} placeholder="Örn: Istanbul" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit">Ara</button>
            </div>
          </div>
        </form>
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h3>Son Aramalarım</h3>
          {recent.map((r) => (
            <span key={r._id} className="recent-search" onClick={() => {
              const q = new URLSearchParams();
              if (r.position) q.set('position', r.position);
              if (r.city) q.set('city', r.city);
              navigate(`/search?${q}`);
            }}>
              {[r.city, r.position].filter(Boolean).join(' – ')}
            </span>
          ))}
        </div>
      )}

      <div className="card">
        <h3>{city} için iş ilanları</h3>
        {jobs.length === 0 ? (
          <div className="muted">İlan bulunamadı.</div>
        ) : (
          jobs.map((j) => <JobCard key={j.id} job={j} />)
        )}
      </div>
    </>
  );
}
