import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cron from 'node-cron';
import routes from './routes.js';
import { connectQueue } from './queue.js';
import { runJobAlerts, runRelatedJobs } from './tasks.js';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.use('/api/v1', routes);

app.use((err, _req, res, _next) => {
  console.error('[notification-service]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  await connectQueue();

  if (process.env.NODE_ENV !== 'production') {
    cron.schedule('*/1 * * * *', async () => {
      try { await runJobAlerts(); } catch (e) { console.error('[cron] runJobAlerts:', e.message); }
    });
    cron.schedule('0 2 * * *', async () => {
      try { await runRelatedJobs(); } catch (e) { console.error('[cron] runRelatedJobs:', e.message); }
    });
    console.log('[cron] schedulers registered (dev mode)');
  }

  app.listen(PORT, () => console.log(`[notification-service] listening on ${PORT}`));
}

start();
