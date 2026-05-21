const target = process.env.TARGET_URL;
const endpoint = process.env.ENDPOINT;
const secret = process.env.INTERNAL_SECRET;

if (!target || !endpoint || !secret) {
  console.error('[cron-worker] missing TARGET_URL/ENDPOINT/INTERNAL_SECRET');
  process.exit(1);
}

const url = `${target}${endpoint}`;
console.log(`[cron-worker] POST ${url}`);

try {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'X-Internal-Secret': secret },
  });
  const body = await r.text();
  console.log(`[cron-worker] status=${r.status} body=${body.slice(0, 500)}`);
  process.exit(r.ok ? 0 : 1);
} catch (err) {
  console.error('[cron-worker] error:', err.message);
  process.exit(1);
}
