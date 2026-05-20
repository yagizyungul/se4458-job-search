import { getMongo } from './mongo.js';
import { drainNewJobs, publishNotification } from './queue.js';

function matchAlert(alert, job) {
  const c = alert.criteria || {};
  if (c.position && !job.title?.toLowerCase().includes(c.position.toLowerCase())) return false;
  if (c.city && job.city?.toLowerCase() !== c.city.toLowerCase()) return false;
  if (c.country && job.country?.toLowerCase() !== c.country.toLowerCase()) return false;
  if (c.workingType && job.working_type !== c.workingType) return false;
  return true;
}

export async function runJobAlerts() {
  const db = await getMongo();
  const newJobs = await drainNewJobs(200);
  if (!newJobs.length) {
    return { processed: 0, matched: 0 };
  }

  const alerts = await db.collection('jobAlerts').find({ active: true }).toArray();
  let matched = 0;
  for (const job of newJobs) {
    for (const alert of alerts) {
      if (matchAlert(alert, job)) {
        const notif = {
          userId: alert.userId,
          type: 'JOB_ALERT',
          payload: { jobId: job.id, title: job.title, city: job.city, companyId: job.company_id },
          sentAt: new Date(),
        };
        await db.collection('notificationLog').insertOne(notif);
        publishNotification(notif);
        matched += 1;
      }
    }
  }
  console.log(`[tasks] job-alerts: jobs=${newJobs.length}, notifications=${matched}`);
  return { processed: newJobs.length, matched };
}

export async function runRelatedJobs() {
  const db = await getMongo();
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const searchUrl = process.env.JOB_SEARCH_URL || 'http://localhost:3002';

  let searches = [];
  try {
    const r = await fetch(`${searchUrl}/api/v1/internal/user-searches?since=${since.toISOString()}`);
    if (r.ok) {
      const j = await r.json();
      searches = j.data || [];
    }
  } catch (err) {
    console.warn('[tasks] could not fetch user searches:', err.message);
    return { sent: 0, error: err.message };
  }

  const byUser = new Map();
  for (const s of searches) {
    const existing = byUser.get(s.userId);
    if (!existing || s.searchedAt > existing.searchedAt) byUser.set(s.userId, s);
  }

  let sent = 0;
  for (const [userId, last] of byUser) {
    const url = new URL(`${searchUrl}/api/v1/jobs/search`);
    if (last.position) url.searchParams.set('position', last.position);
    if (last.city) url.searchParams.set('city', last.city);
    url.searchParams.set('pageSize', '3');

    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (!j.data?.length) continue;
      const notif = {
        userId,
        type: 'RELATED_JOB',
        payload: { jobs: j.data.map((x) => ({ id: x.id, title: x.title, city: x.city })) },
        sentAt: new Date(),
      };
      await db.collection('notificationLog').insertOne(notif);
      publishNotification(notif);
      sent += 1;
    } catch (err) {
      console.warn('[tasks] related-jobs error:', err.message);
    }
  }
  console.log(`[tasks] related-jobs: users=${byUser.size}, sent=${sent}`);
  return { users: byUser.size, sent };
}
