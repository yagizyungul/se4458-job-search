import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { signIn, signUp, devLogin, supabaseEnabled } = useAuth();
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'signup') {
        await signUp({ email, password, role });
        setMsg('Kayıt başarılı! Eğer email onayı isteniyorsa gelen kutuna bak. Sonra giriş yap.');
        setMode('signin');
      } else {
        await signIn({ email, password });
        navigate(search.get('redirect') || '/');
      }
    } catch (err) {
      setMsg('Hata: ' + (err?.message || 'bilinmeyen'));
    } finally {
      setBusy(false);
    }
  };

  // Dev fallback when Supabase not configured (local dev only)
  const [devUserId, setDevUserId] = useState('demo-user');
  const [devRole, setDevRole] = useState('user');
  const devSubmit = (e) => {
    e.preventDefault();
    devLogin({ userId: devUserId, role: devRole });
    navigate(search.get('redirect') || '/');
  };

  if (!supabaseEnabled) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
        <h2>Giriş (Dev Mode)</h2>
        <p className="muted">
          Supabase env vars yok — dev token üretiliyor. Production'da
          VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY set edilince gerçek auth aktif olur.
        </p>
        <form onSubmit={devSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label>Kullanıcı ID</label>
            <input value={devUserId} onChange={(e) => setDevUserId(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Rol</label>
            <select value={devRole} onChange={(e) => setDevRole(e.target.value)} style={{ width: '100%' }}>
              <option value="user">User</option>
              <option value="company">Company</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit">Dev Giriş</button>
        </form>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={mode === 'signin' ? '' : 'secondary'}
          onClick={() => { setMode('signin'); setMsg(''); }}
          style={{ flex: 1 }}
        >
          Giriş
        </button>
        <button
          type="button"
          className={mode === 'signup' ? '' : 'secondary'}
          onClick={() => { setMode('signup'); setMsg(''); }}
          style={{ flex: 1 }}
        >
          Kayıt Ol
        </button>
      </div>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Şifre</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            style={{ width: '100%' }}
          />
        </div>
        {mode === 'signup' && (
          <div style={{ marginBottom: 10 }}>
            <label>Rol</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
              <option value="user">User (iş arayan)</option>
              <option value="company">Company (ilan veren)</option>
              <option value="admin">Admin</option>
            </select>
            <small className="muted">Demo amaçlı kullanıcı kendi rolünü seçebiliyor.</small>
          </div>
        )}
        <button type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Bekleyin...' : (mode === 'signup' ? 'Hesap Oluştur' : 'Giriş Yap')}
        </button>
        {msg && (
          <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
