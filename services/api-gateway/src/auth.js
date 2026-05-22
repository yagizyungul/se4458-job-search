import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'dev-secret';
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

function parseToken(token) {
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
    return null;
  }
}

export function verifyAuth({ required = false, requiredRole = null } = {}) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (required || requiredRole) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return next();
    }

    const user = parseToken(token);
    if (!user) {
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
