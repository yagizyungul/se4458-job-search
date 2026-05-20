import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getMongo } from './mongo.js';
import { runJobAlerts, runRelatedJobs } from './tasks.js';

const router = Router();
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'dev-internal-secret';

function requireUser(req, res, next) {
  req.userId = req.headers['x-user-id'];
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireInternal(req, res, next) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

router.post('/notifications/alerts', requireUser, async (req, res, next) => {
  try {
    const { position, city, country, workingType, channels } = req.body;
    const db = await getMongo();
    const doc = {
      userId: req.userId,
      criteria: { position, city, country, workingType },
      channels: channels || ['email'],
      active: true,
      createdAt: new Date(),
    };
    const r = await db.collection('jobAlerts').insertOne(doc);
    res.status(201).json({ id: r.insertedId, ...doc });
  } catch (err) { next(err); }
});

router.get('/notifications/alerts', requireUser, async (req, res, next) => {
  try {
    const db = await getMongo();
    const items = await db.collection('jobAlerts').find({ userId: req.userId }).toArray();
    res.json({ data: items });
  } catch (err) { next(err); }
});

router.delete('/notifications/alerts/:id', requireUser, async (req, res, next) => {
  try {
    const db = await getMongo();
    const r = await db.collection('jobAlerts').deleteOne({
      _id: new ObjectId(req.params.id), userId: req.userId,
    });
    if (!r.deletedCount) return res.status(404).json({ error: 'Alert not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/notifications/log', requireUser, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, parseInt(req.query.pageSize) || 20);
    const db = await getMongo();
    const total = await db.collection('notificationLog').countDocuments({ userId: req.userId });
    const data = await db.collection('notificationLog')
      .find({ userId: req.userId })
      .sort({ sentAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    res.json({ data, page, pageSize, total, pageCount: Math.ceil(total / pageSize) });
  } catch (err) { next(err); }
});

router.post('/internal/run-job-alerts', requireInternal, async (_req, res, next) => {
  try {
    const result = await runJobAlerts();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/internal/run-related-jobs', requireInternal, async (_req, res, next) => {
  try {
    const result = await runRelatedJobs();
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
