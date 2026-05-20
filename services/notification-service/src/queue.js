import amqp from 'amqplib';

let channel = null;
const QUEUE_NEW_JOBS = 'new-job-postings';
const QUEUE_NOTIFICATIONS = 'user-notifications';
const buffered = [];

export async function connectQueue() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    console.warn('[queue] RABBITMQ_URL not set');
    return;
  }
  try {
    const conn = await amqp.connect(url);
    channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NEW_JOBS, { durable: true });
    await channel.assertQueue(QUEUE_NOTIFICATIONS, { durable: true });
    console.log('[queue] connected');
  } catch (err) {
    console.error('[queue] connect failed:', err.message);
  }
}

export async function drainNewJobs(max = 100) {
  const msgs = [];
  if (!channel) return msgs;
  for (let i = 0; i < max; i++) {
    const m = await channel.get(QUEUE_NEW_JOBS, { noAck: false });
    if (!m) break;
    try {
      msgs.push(JSON.parse(m.content.toString()));
      channel.ack(m);
    } catch {
      channel.nack(m, false, false);
    }
  }
  return msgs;
}

export function publishNotification(payload) {
  if (!channel) {
    buffered.push(payload);
    return;
  }
  channel.sendToQueue(QUEUE_NOTIFICATIONS, Buffer.from(JSON.stringify(payload)), { persistent: true });
}
