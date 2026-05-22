import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'dev-secret';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const isDev = process.env.NODE_ENV !== 'production';

// Extract application role from a Supabase JWT.
// Supabase puts the Postgres role (e.g., "authenticated") in `role`, which is
// NOT our app role. The app role is stored where we saved it at signup time:
// app_metadata.role (preferred, server-set) or user_metadata.role (client-set).
function extractAppRole(decoded) {
  return (
    decoded.app_metadata?.role
    || decoded.user_metadata?.role
    || 'user'
  );
}

async function verifyWithSupabase(token) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    const user = await response.json();
    return {
      sub: user.id,
      role: user.app_metadata?.role || user.user_metadata?.role || 'user',
      email: user.email,
    };
  } catch {
    return null;
  }
}

async function parseToken(token) {
  // Dev token shortcut for local development only.
  if (isDev && token.startsWith('dev-')) {
    const [, role, ...userIdParts] = token.split('-');
    const userId = userIdParts.join('-');
    if (!role || !userId) return null;
    return { sub: userId, role };
  }
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    return {
      sub: decoded.sub,
      role: extractAppRole(decoded),
      email: decoded.email,
    };
  } catch {
    return verifyWithSupabase(token);
  }
}

export function verifyAuth({ required = false, requiredRole = null } = {}) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (required || requiredRole) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return next();
    }

    const user = await parseToken(token);
    if (!user) {
      if (!required && !requiredRole) {
        return next();
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (requiredRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    req.user = user;
    next();
  };
}
