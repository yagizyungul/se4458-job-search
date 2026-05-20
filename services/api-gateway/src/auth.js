import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'dev-secret';
const isDev = process.env.NODE_ENV !== 'production';

function parseToken(token) {
  if (isDev && token.startsWith('dev-')) {
    const [, role, userId] = token.split('-');
    if (!role || !userId) return null;
    return { sub: userId, role };
  }
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    return {
      sub: decoded.sub,
      role: decoded.role || decoded.app_metadata?.role || 'user',
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
