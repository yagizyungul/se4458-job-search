import pg from 'pg';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

if (redis) {
  redis.connect().catch((err) => console.warn('[cache] redis connect failed:', err.message));
}

let mongoDb = null;
export async function getMongo() {
  if (mongoDb) return mongoDb;
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017/jobsearch';
  const client = await MongoClient.connect(url);
  mongoDb = client.db();
  await mongoDb.collection('userSearches').createIndex({ userId: 1, searchedAt: -1 });
  return mongoDb;
}
