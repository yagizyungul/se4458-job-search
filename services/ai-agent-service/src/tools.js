const JOB_SEARCH_URL = process.env.JOB_SEARCH_URL || 'http://localhost:3002';
const JOB_POSTING_URL = process.env.JOB_POSTING_URL || 'http://localhost:3001';

export const toolDefinitions = [
  {
    name: 'search_jobs',
    description: 'Search for job postings by position, city, country, town, or working type. Use this whenever the user mentions criteria for a job they want to find.',
    input_schema: {
      type: 'object',
      properties: {
        position: { type: 'string', description: 'Job title or position keyword (e.g., "web developer")' },
        city: { type: 'string', description: 'City name (e.g., "Istanbul")' },
        country: { type: 'string', description: 'Country name (e.g., "Turkey")' },
        workingType: { type: 'string', enum: ['fulltime', 'parttime', 'remote', 'hybrid', 'internship'] },
        pageSize: { type: 'number', description: 'Number of jobs to return, default 5' },
      },
    },
  },
  {
    name: 'apply_to_job',
    description: 'Apply the current logged-in user to a job posting by its id. Use this once the user has explicitly chosen one of the search results to apply to.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'UUID of the job to apply to' },
      },
      required: ['jobId'],
    },
  },
];

export async function runTool(name, input, ctx) {
  if (name === 'search_jobs') {
    const url = new URL(`${JOB_SEARCH_URL}/api/v1/jobs/search`);
    for (const [k, v] of Object.entries(input)) {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
    if (!url.searchParams.has('pageSize')) url.searchParams.set('pageSize', '5');
    const r = await fetch(url, { headers: ctx.userId ? { 'X-User-Id': ctx.userId } : {} });
    if (!r.ok) return { error: `search failed (${r.status})` };
    const j = await r.json();
    return { jobs: j.data, total: j.total };
  }
  if (name === 'apply_to_job') {
    if (!ctx.userId) return { error: 'User must be logged in to apply' };
    const r = await fetch(`${JOB_POSTING_URL}/api/v1/jobs/${input.jobId}/apply`, {
      method: 'POST',
      headers: { 'X-User-Id': ctx.userId },
    });
    if (!r.ok) {
      const text = await r.text();
      return { error: `apply failed: ${text}` };
    }
    return await r.json();
  }
  return { error: `unknown tool ${name}` };
}
