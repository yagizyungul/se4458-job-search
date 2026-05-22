import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Detail from './pages/Detail.jsx';
import Admin from './pages/Admin.jsx';
import Login from './pages/Login.jsx';
import Alerts from './pages/Alerts.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import { useAuth } from './auth.jsx';

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <header className="header">
        <h1><Link to="/" style={{ color: 'white' }}>kariyer.dev</Link></h1>
        <nav>
          <Link to="/">Ana Sayfa</Link>
          <Link to="/search">Iş Ara</Link>
          {user && <Link to="/alerts">Iş Alarmı</Link>}
          {user?.role === 'admin' || user?.role === 'company' ? <Link to="/admin">Admin</Link> : null}
          {user ? (
            <a onClick={async () => { await logout(); navigate('/'); }} style={{ cursor: 'pointer' }}>
              Çıkış ({user.email || user.userId})
            </a>
          ) : (
            <Link to="/login">Giriş</Link>
          )}
        </nav>
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/jobs/:id" element={<Detail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
      <ChatWidget />
    </div>
  );
}
