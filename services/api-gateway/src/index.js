import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyAuth } from './auth.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

const targets = {
  jobPosting: process.env.JOB_POSTING_URL || 'http://localhost:3001',
  jobSearch: process.env.JOB_SEARCH_URL || 'http://localhost:3002',
  notification: process.env.NOTIFICATION_URL || 'http://localhost:3003',
  aiAgent: process.env.AI_AGENT_URL || 'http://localhost:3004',
};

const proxy = (target) => createProxyMiddleware({
  target,
  changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.sub);
      proxyReq.setHeader('X-User-Role', req.user.role || 'user');
    }
  },
});

app.post(
  /^\/api\/v1\/jobs\/[^/]+\/apply\/?$/,
  verifyAuth({ required: true }),
  proxy(targets.jobPosting),
);

app.use('/api/v1/admin', verifyAuth({ requiredRole: ['admin', 'company'] }), proxy(targets.jobPosting));

app.use('/api/v1/jobs', verifyAuth({ required: false }), proxy(targets.jobSearch));
app.use('/api/v1/searches', verifyAuth({ required: true }), proxy(targets.jobSearch));

app.use('/api/v1/notifications', verifyAuth({ required: true }), proxy(targets.notification));

app.use('/api/v1/ai', verifyAuth({ required: false }), proxy(targets.aiAgent));

app.use((err, _req, res, _next) => {
  console.error('[gateway-error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Gateway error' });
});

app.listen(PORT, () => {
  console.log(`[api-gateway] listening on ${PORT}`);
  console.log('[api-gateway] targets:', targets);
});
