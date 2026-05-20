import { Router } from 'express';
import crypto from 'crypto';
import { pool, redis, getMongo } from './connections.js';

const router = Router();
const CACHE_TTL_JOB = 600;
const CACHE_TTL_SEARCH = 60;

function hashKey(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

async function cacheGet(key) {
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

async function cacheSet(key, value, ttl) {
  if (!redis) return;
  try { await redis.set(key, JSON.stringify(value), 'EX', ttl); } catch {}
}

router.get('/jobs/autocomplete', async (req, res, next) => {
  try {
    const type = req.query.type === 'city' ? 'city' : 'position';
    const q = (req.query.q || '').toString().trim();
    if (q.length < 1) return res.json({ suggestions: [] });

    const col = type === 'city' ? 'city' : 'title';
    const { rows } = await pool.query(
      `SELECT DISTINCT ${col} AS value FROM jobs
       WHERE is_active = true AND LOWER(${col}) LIKE LOWER($1)
       ORDER BY value LIMIT 10`,
      [`${q}%`],
    );
    res.json({ suggestions: rows.map((r) => r.value) });
  } catch (err) { next(err); }
});

router.get('/jobs/search', async (req, res, next) => {
  try {
    const filters = {
      position: req.query.position || '',
      country: req.query.country || '',
      city: req.query.city || '',
      town: req.query.town || '',
      workingType: req.query.workingType || '',
    };
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize) || 10);

    const cacheKey = `jobs:search:${hashKey({ filters, page, pageSize })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const where = ['j.is_active = true'];
    const vals = [];
    let i = 1;
    if (filters.position) { where.push(`LOWER(j.title) LIKE LOWER($${i++})`); vals.push(`%${filters.position}%`); }
    if (filters.country) { where.push(`LOWER(j.country) = LOWER($${i++})`); vals.push(filters.country); }
    if (filters.city) { where.push(`LOWER(j.city) = LOWER($${i++})`); vals.push(filters.city); }
    if (filters.town) { where.push(`LOWER(j.town) = LOWER($${i++})`); vals.push(filters.town); }
    if (filters.workingType) { where.push(`j.working_type = $${i++}`); vals.push(filters.workingType); }

    const offset = (page - 1) * pageSize;
    const totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM jobs j WHERE ${where.join(' AND ')}`, vals);
    const total = totalRes.rows[0].c;
    const result = await pool.query(`
      SELECT j.id, j.title, j.description, j.country, j.city, j.town, j.working_type, j.seniority,
             j.application_count, j.last_updated, c.name AS company_name
      FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
      WHERE ${where.join(' AND ')}
      ORDER BY j.last_updated DESC
      LIMIT $${i++} OFFSET $${i}
    `, [...vals, pageSize, offset]);

    const userId = req.headers['x-user-id'];
    if (userId && (filters.position || filters.city)) {
      try {
        const db = await getMongo();
        await db.collection('userSearches').insertOne({
          userId, ...filters, searchedAt: new Date(),
        });
      } catch (err) {
        console.warn('[search-log] mongo write failed:', err.message);
      }
    }

    const payload = {
      data: result.rows,
      page, pageSize, total,
      pageCount: Math.ceil(total / pageSize),
      filters,
    };
    await cacheSet(cacheKey, payload, CACHE_TTL_SEARCH);
    res.set('X-Cache', 'MISS');
    res.json(payload);
  } catch (err) { next(err); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(20, parseInt(req.query.pageSize) || 5);
    const offset = (page - 1) * pageSize;
    const city = req.query.city;

    let where = 'j.is_active = true';
    const vals = [];
    if (city) {
      where += ' AND LOWER(j.city) = LOWER($1)';
      vals.push(city);
    }

    let totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM jobs j WHERE ${where}`, vals);
    let total = totalRes.rows[0].c;

    let rows;
    if (total === 0 && city) {
      const fallback = await pool.query(`
        SELECT j.id, j.title, j.country, j.city, j.town, j.working_type, j.last_updated, c.name AS company_name
        FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
        WHERE j.is_active = true
        ORDER BY j.last_updated DESC LIMIT $1 OFFSET $2
      `, [pageSize, offset]);
      rows = fallback.rows;
      total = (await pool.query('SELECT COUNT(*)::int AS c FROM jobs WHERE is_active = true')).rows[0].c;
    } else {
      const cityArgsOffset = vals.length;
      const r = await pool.query(`
        SELECT j.id, j.title, j.country, j.city, j.town, j.working_type, j.last_updated, c.name AS company_name
        FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
        WHERE ${where}
        ORDER BY j.last_updated DESC LIMIT $${cityArgsOffset + 1} OFFSET $${cityArgsOffset + 2}
      `, [...vals, pageSize, offset]);
      rows = r.rows;
    }

    res.json({ data: rows, page, pageSize, total, pageCount: Math.ceil(total / pageSize) });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const cacheKey = `job:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    const { rows } = await pool.query(`
      SELECT j.*, c.name AS company_name
      FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1 AND j.is_active = true
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
    await cacheSet(cacheKey, rows[0], CACHE_TTL_JOB);
    res.set('X-Cache', 'MISS');
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/jobs/:id/related', async (req, res, next) => {
  try {
    const { rows: base } = await pool.query('SELECT title, city, working_type FROM jobs WHERE id = $1', [req.params.id]);
    if (!base[0]) return res.status(404).json({ error: 'Job not found' });
    const { rows } = await pool.query(`
      SELECT j.id, j.title, j.city, j.working_type, c.name AS company_name
      FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.is_active = true AND j.id <> $1
        AND (j.city = $2 OR j.working_type = $3 OR LOWER(j.title) LIKE LOWER($4))
      ORDER BY (CASE WHEN j.city = $2 THEN 0 ELSE 1 END), j.last_updated DESC
      LIMIT 3
    `, [req.params.id, base[0].city, base[0].working_type, `%${base[0].title.split(' ')[0]}%`]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

router.get('/searches/recent', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const db = await getMongo();
    const items = await db.collection('userSearches')
      .find({ userId }).sort({ searchedAt: -1 }).limit(5).toArray();
    res.json({ data: items });
  } catch (err) { next(err); }
});

router.get('/internal/user-searches', async (req, res, next) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 3600 * 1000);
    const db = await getMongo();
    const items = await db.collection('userSearches').find({ searchedAt: { $gte: since } }).limit(1000).toArray();
    res.json({ data: items });
  } catch (err) { next(err); }
});

export default router;
