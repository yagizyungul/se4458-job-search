import { MongoClient } from 'mongodb';

let db = null;
export async function getMongo() {
  if (db) return db;
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017/notifications';
  const client = await MongoClient.connect(url);
  db = client.db();
  await db.collection('jobAlerts').createIndex({ userId: 1, active: 1 });
  await db.collection('notificationLog').createIndex({ userId: 1, sentAt: -1 });
  return db;
}
