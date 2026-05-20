import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import JobCard from '../components/JobCard.jsx';

const FILTER_LABELS = {
  position: 'Pozisyon',
  country: 'Ülke',
  city: 'Şehir',
  town: 'İlçe',
  workingType: 'Çalışma',
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ data: [], total: 0, page: 1, pageCount: 1, filters: {} });
  const [loading, setLoading] = useState(false);

  const filters = {
    position: searchParams.get('position') || '',
    country: searchParams.get('country') || '',
    city: searchParams.get('city') || '',
    town: searchParams.get('town') || '',
    workingType: searchParams.get('workingType') || '',
  };
  const page = parseInt(searchParams.get('page')) || 1;

  useEffect(() => {
    setLoading(true);
    api.searchJobs({ ...filters, page, pageSize: 10 })
      .then(setData)
      .catch(() => setData({ data: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  const goPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', p);
    setSearchParams(next);
  };

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  return (
    <div className="layout">
      <aside className="filters">
        <div className="card">
          <h3>Filtreler</h3>
          <div style={{ marginBottom: 10 }}>
            <label>Ülke</label>
            <input value={filters.country} onChange={(e) => updateFilter('country', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Şehir</label>
            <input value={filters.city} onChange={(e) => updateFilter('city', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>İlçe</label>
            <input value={filters.town} onChange={(e) => updateFilter('town', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Çalışma Türü</label>
            <select value={filters.workingType} onChange={(e) => updateFilter('workingType', e.target.value)} style={{ width: '100%' }}>
              <option value="">Tümü</option>
              <option value="fulltime">Tam Zamanlı</option>
              <option value="parttime">Yarı Zamanlı</option>
              <option value="remote">Uzaktan</option>
              <option value="hybrid">Hibrit</option>
              <option value="internship">Staj</option>
            </select>
          </div>
        </div>
      </aside>
      <main>
        <div className="card">
          <h2>Arama Sonuçları ({data.total})</h2>
          <div className="badges">
            {activeFilters.map(([k, v]) => (
              <span key={k} className="badge">
                {FILTER_LABELS[k]}: {v}
                <button onClick={() => updateFilter(k, '')} title="Kaldır">×</button>
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          {loading ? (
            <div className="muted">Yükleniyor...</div>
          ) : data.data.length === 0 ? (
            <div className="muted">Sonuç bulunamadı.</div>
          ) : (
            <>
              {data.data.map((j) => <JobCard key={j.id} job={j} />)}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button disabled={page <= 1} onClick={() => goPage(page - 1)}>‹</button>
                <span style={{ alignSelf: 'center' }}>Sayfa {page} / {data.pageCount}</span>
                <button disabled={page >= data.pageCount} onClick={() => goPage(page + 1)}>›</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
