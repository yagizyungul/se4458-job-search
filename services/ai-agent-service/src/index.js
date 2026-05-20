import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { aiProvider, chat } from './agent.js';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  service: 'ai-agent-service',
  aiProvider: aiProvider(),
  aiEnabled: aiProvider() !== 'demo',
}));

app.post('/api/v1/ai/chat', async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const userId = req.headers['x-user-id'] || null;
    const result = await chat({ messages, userId });
    res.json(result);
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => {
  console.error('[ai-agent-service]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`[ai-agent-service] listening on ${PORT}`));
