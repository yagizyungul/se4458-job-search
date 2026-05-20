import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [userId, setUserId] = useState('demo-user');
  const [role, setRole] = useState('user');
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const submit = (e) => {
    e.preventDefault();
    login({ userId, role });
    navigate(search.get('redirect') || '/');
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2>Giriş</h2>
      <p className="muted">
        Bu demo dev modda çalışıyor – token şu formatta: <code>dev-&lt;role&gt;-&lt;userId&gt;</code>.
        Production'da Supabase Auth üzerinden giriş yapılacak.
      </p>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <label>Kullanıcı ID</label>
          <input value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
            <option value="user">User</option>
            <option value="company">Company</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit">Giriş Yap</button>
      </form>
    </div>
  );
}
