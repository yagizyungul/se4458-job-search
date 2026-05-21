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
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=en`;
          const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (!r.ok) return;
          const data = await r.json();
          const detected = data.address?.city
            || data.address?.town
            || data.address?.county
            || data.address?.state;
          if (detected) setCity(detected);
        } catch {
          // silently fall back to DEFAULT_CITY
        }
      },
      () => { /* user denied, keep default */ },
      { timeout: 4000, maximumAge: 600000 },
    );
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
