import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'job-search-service' }));
app.use('/api/v1', routes);

app.use((err, _req, res, _next) => {
  console.error('[job-search-service]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`[job-search-service] listening on ${PORT}`));
