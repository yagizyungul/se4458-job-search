import Redis from 'ioredis';

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

if (redis) {
  redis.connect().catch((err) => console.warn('[cache] redis connect failed:', err.message));
}

export async function invalidateJob(id) {
  if (!redis) return;
  try {
    await redis.del(`job:${id}`);
  } catch {}
}
