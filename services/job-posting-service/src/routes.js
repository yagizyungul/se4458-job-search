import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { pool } from './db.js';
import { publishNewJob } from './queue.js';
import { invalidateJob } from './cache.js';

const router = Router();

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.userId = req.headers['x-user-id'];
    next();
  };
}

const jobSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(5),
  country: z.string().default('Turkey'),
  city: z.string().min(2),
  town: z.string().optional().default(''),
  workingType: z.enum(['fulltime', 'parttime', 'remote', 'hybrid', 'internship']),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead']).default('mid'),
  requirements: z.array(z.string()).default([]),
  companyId: z.string().uuid().optional(),
  companyName: z.string().optional(),
});

router.get('/admin/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/admin/jobs', requireRole('admin', 'company'), async (req, res, next) => {
  try {
    const data = jobSchema.parse(req.body);

    let companyId = data.companyId;
    if (!companyId) {
      const name = data.companyName || 'Unnamed Company';
      const company = await pool.query(
        'INSERT INTO companies (id, name, owner_user_id) VALUES ($1, $2, $3) RETURNING id',
        [uuid(), name, req.userId],
      );
      companyId = company.rows[0].id;
    }

    const id = uuid();
    const { rows } = await pool.query(`
      INSERT INTO jobs (id, company_id, title, description, country, city, town, working_type, seniority, requirements)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [id, companyId, data.title, data.description, data.country, data.city, data.town, data.workingType, data.seniority, data.requirements]);

    publishNewJob(rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.put('/admin/jobs/:id', requireRole('admin', 'company'), async (req, res, next) => {
  try {
    const data = jobSchema.partial().parse(req.body);
    const fields = [];
    const values = [];
    let i = 1;
    const map = {
      title: 'title', description: 'description', country: 'country',
      city: 'city', town: 'town', workingType: 'working_type',
      seniority: 'seniority', requirements: 'requirements',
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(data[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`last_updated = now()`);
    values.push(req.params.id);

    const sql = `UPDATE jobs SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);
    if (!rows[0]) return res.status(404).json({ error: 'Job not found' });
    await invalidateJob(req.params.id);
    res.json(rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.delete('/admin/jobs/:id', requireRole('admin', 'company'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('UPDATE jobs SET is_active = false WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Job not found' });
    await invalidateJob(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/admin/jobs', requireRole('admin', 'company'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize) || 10);
    const offset = (page - 1) * pageSize;
    const total = (await pool.query('SELECT COUNT(*)::int AS c FROM jobs')).rows[0].c;
    const { rows } = await pool.query(`
      SELECT j.*, c.name AS company_name
      FROM jobs j LEFT JOIN companies c ON c.id = j.company_id
      ORDER BY j.last_updated DESC LIMIT $1 OFFSET $2
    `, [pageSize, offset]);
    res.json({ data: rows, page, pageSize, total, pageCount: Math.ceil(total / pageSize) });
  } catch (err) { next(err); }
});

router.post('/jobs/:id/apply', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const exists = await pool.query('SELECT id FROM jobs WHERE id = $1 AND is_active = true', [req.params.id]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Job not found' });

    try {
      await pool.query('INSERT INTO applications (id, job_id, user_id) VALUES ($1, $2, $3)', [uuid(), req.params.id, userId]);
      await pool.query('UPDATE jobs SET application_count = application_count + 1 WHERE id = $1', [req.params.id]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Already applied' });
      }
      throw err;
    }
    res.status(201).json({ status: 'applied', jobId: req.params.id });
  } catch (err) { next(err); }
});

router.get('/internal/jobs/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT j.*, c.name AS company_name FROM jobs j
      LEFT JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
