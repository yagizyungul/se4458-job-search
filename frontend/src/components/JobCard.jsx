import { Link } from 'react-router-dom';

export default function JobCard({ job }) {
  return (
    <div className="job">
      <h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3>
      <div className="muted">{job.company_name || 'Şirket'}</div>
      <div className="muted">{[job.town, job.city, job.country].filter(Boolean).join(', ')}</div>
      <div className="badges" style={{ marginTop: 6 }}>
        <span className="tag">{job.working_type}</span>
        {job.seniority && <span className="tag">{job.seniority}</span>}
      </div>
    </div>
  );
}
