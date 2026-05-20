import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes.js';
import { initSchema, seedDemoData } from './db.js';
import { connectQueue } from './queue.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'job-posting-service' }));
app.use('/api/v1', routes);

app.use((err, _req, res, _next) => {
  console.error('[job-posting-service]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  try {
    await initSchema();
    await seedDemoData();
  } catch (err) {
    console.error('[job-posting-service] db init failed:', err.message);
  }
  await connectQueue();
  app.listen(PORT, () => console.log(`[job-posting-service] listening on ${PORT}`));
}

start();
