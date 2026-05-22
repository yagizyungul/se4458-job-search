import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseEnabled } from './supabase.js';

const AuthContext = createContext(null);

function extractRole(supabaseUser) {
  if (!supabaseUser) return null;
  return (
    supabaseUser.app_metadata?.role
    || supabaseUser.user_metadata?.role
    || 'user'
  );
}

function makeUserShape(supabaseUser) {
  if (!supabaseUser) return null;
  return {
    userId: supabaseUser.id,
    email: supabaseUser.email,
    role: extractRole(supabaseUser),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseEnabled) {
      const raw = localStorage.getItem('user');
      const stored = raw ? JSON.parse(raw) : null;
      const storedToken = localStorage.getItem('token');
      if (stored) setUser(stored);
      if (storedToken) setToken(storedToken);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setUser(makeUserShape(data.session.user));
        setToken(data.session.access_token);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(makeUserShape(session.user));
        setToken(session.access_token);
      } else {
        setUser(null);
        setToken(null);
      }
    });

    return () => sub?.subscription?.unsubscribe();
  }, []);

  const signUp = async ({ email, password, role }) => {
    if (!supabaseEnabled) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: role || 'user' } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async ({ email, password }) => {
    if (!supabaseEnabled) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const devLogin = ({ userId, role }) => {
    const devToken = `dev-${role}-${userId}`;
    localStorage.setItem('token', devToken);
    const u = { userId, role, email: `${userId}@dev.local` };
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setToken(devToken);
  };

  const logout = async () => {
    if (supabaseEnabled) await supabase.auth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, signUp, signIn, devLogin, logout, supabaseEnabled }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
