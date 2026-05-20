import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      owner_user_id VARCHAR(120),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      country VARCHAR(80),
      city VARCHAR(80),
      town VARCHAR(80),
      working_type VARCHAR(20),
      seniority VARCHAR(20),
      requirements TEXT[],
      application_count INT DEFAULT 0,
      last_updated TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now(),
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
    CREATE INDEX IF NOT EXISTS idx_jobs_title ON jobs(title);
    CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active);

    CREATE TABLE IF NOT EXISTS applications (
      id UUID PRIMARY KEY,
      job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
      user_id VARCHAR(120) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(job_id, user_id)
    );
  `);
}

export async function seedDemoData() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM jobs');
  if (rows[0].c > 0) return;

  const { v4: uuid } = await import('uuid');
  const companies = [
    { id: uuid(), name: 'Acme Tech' },
    { id: uuid(), name: 'BlueWave Software' },
    { id: uuid(), name: 'CodeForge Inc' },
  ];
  for (const c of companies) {
    await pool.query('INSERT INTO companies (id, name, owner_user_id) VALUES ($1, $2, $3)', [c.id, c.name, 'demo-owner']);
  }

  const sampleJobs = [
    { title: 'Junior Web Developer', city: 'Istanbul', town: 'Kadikoy', wt: 'fulltime', sen: 'junior', reqs: ['React', 'Angular', 'Computer Engineering graduate'] },
    { title: 'Senior Frontend Developer', city: 'Istanbul', town: 'Besiktas', wt: 'fulltime', sen: 'senior', reqs: ['TypeScript', 'React', '5+ years'] },
    { title: 'Backend Engineer', city: 'Ankara', town: 'Cankaya', wt: 'remote', sen: 'mid', reqs: ['Node.js', 'PostgreSQL'] },
    { title: 'Full Stack Developer', city: 'Izmir', town: 'Konak', wt: 'hybrid', sen: 'mid', reqs: ['React', 'Node.js', 'Docker'] },
    { title: 'DevOps Engineer', city: 'Istanbul', town: 'Sariyer', wt: 'remote', sen: 'senior', reqs: ['Kubernetes', 'AWS', 'Terraform'] },
    { title: 'Data Engineer', city: 'Ankara', town: 'Yenimahalle', wt: 'fulltime', sen: 'mid', reqs: ['Python', 'Spark', 'Airflow'] },
    { title: 'Mobile Developer (iOS)', city: 'Istanbul', town: 'Sisli', wt: 'hybrid', sen: 'mid', reqs: ['Swift', 'SwiftUI'] },
    { title: 'QA Automation Engineer', city: 'Izmir', town: 'Karsiyaka', wt: 'fulltime', sen: 'mid', reqs: ['Selenium', 'Playwright'] },
  ];

  for (let i = 0; i < sampleJobs.length; i++) {
    const s = sampleJobs[i];
    const c = companies[i % companies.length];
    await pool.query(`
      INSERT INTO jobs (id, company_id, title, description, country, city, town, working_type, seniority, requirements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      uuid(), c.id, s.title,
      `${s.title} role at ${c.name}. ${s.reqs.join(', ')}`,
      'Turkey', s.city, s.town, s.wt, s.sen, s.reqs,
    ]);
  }
  console.log('[job-posting-service] seeded demo data');
}
