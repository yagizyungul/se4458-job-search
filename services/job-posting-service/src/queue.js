import amqp from 'amqplib';

let channel = null;
const QUEUE_NEW_JOBS = 'new-job-postings';

export async function connectQueue() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.warn('[queue] RABBITMQ_URL not set — running without queue');
    return;
  }
  try {
    const conn = await amqp.connect(url);
    channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NEW_JOBS, { durable: true });
    console.log('[queue] connected, queue:', QUEUE_NEW_JOBS);
  } catch (err) {
    console.error('[queue] connection failed:', err.message);
  }
}

export function publishNewJob(job) {
  if (!channel) return;
  channel.sendToQueue(QUEUE_NEW_JOBS, Buffer.from(JSON.stringify(job)), { persistent: true });
}
