# Job Search Application - SE4458 Final Project

**Student:** YAGIZ YUNGUL
**Group:** 2
**Course:** SE 4458 Software Architecture & Design of Modern Large Scale Systems
**Date:** May 2026

A microservices-based job search web application similar to kariyer.net.

## Live Deployment URLs

- **Frontend (UI):** https://frontend-k1lq.onrender.com
- **API Gateway:** https://api-gateway-pg76.onrender.com
- **API health check:** https://api-gateway-pg76.onrender.com/health
- **Sample API call:** https://api-gateway-pg76.onrender.com/api/v1/jobs?city=Istanbul&pageSize=5
- **Demo Video:** *(video link buraya — kayıt sonrası eklenecek)*

> Note: Hosted on Render free tier — services spin down after 15 min of inactivity. First request after sleep may take 30-60s to wake up.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend (Vite)                   │
│              Home / Search / Detail / Admin / AI             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (Express)                   │
│            JWT verify · Routing · Rate limit · CORS          │
└──┬───────────┬───────────┬──────────────┬───────────────────┘
   │           │           │              │
   ▼           ▼           ▼              ▼
┌──────┐  ┌────────┐  ┌──────────┐  ┌──────────┐
│ Job  │  │  Job   │  │Notificat-│  │ AI Agent │
│Posti-│  │ Search │  │   ion    │  │ Service  │
│ ng   │  │Service │  │ Service  │  │AI Model  │
└──┬───┘  └───┬────┘  └───┬──────┘  └────┬─────┘
   │          │           │              │
   │          ▼           ▼              │
   │      ┌──────┐    ┌──────┐           │
   │      │Redis │    │Mongo │           │
   │      │Cache │    │  DB  │           │
   │      └──────┘    └──────┘           │
   │                       ▲              │
   ▼                       │              │
┌──────────┐         ┌──────────┐         │
│PostgreSQL│         │ RabbitMQ │◄────────┘
│  (jobs)  │         │  Queue   │
└──────────┘         └──────────┘
                            ▲
                            │
                     ┌──────────┐
                     │Supabase  │
                     │   IAM    │
                     └──────────┘
```

### Microservices

| Service | Port | Purpose | Database |
|--|--|--|--|
| `api-gateway` | 8080 | Routing, auth verify, rate limiting | - |
| `job-posting-service` | 3001 | CRUD jobs (admins/companies) | PostgreSQL |
| `job-search-service` | 3002 | Search, autocomplete, recent searches | Redis cache + MongoDB |
| `notification-service` | 3003 | Job alerts, related notifications, scheduled tasks | MongoDB |
| `ai-agent-service` | 3004 | Chat-based search & apply via Anthropic or Gemini tool-use | - |

## Functional Requirements Coverage

### Admin Service (R1)
- `POST /api/v1/admin/jobs` – authorized admins/companies create jobs
- `PUT /api/v1/admin/jobs/:id` – update existing job
- `DELETE /api/v1/admin/jobs/:id` – soft-delete a job
- Auth verified via IAM-issued JWT (role=admin/company)

### Home Page (R2)
- `GET /api/v1/jobs/autocomplete?type=position&q=...`
- `GET /api/v1/jobs/autocomplete?type=city&q=...`
- `GET /api/v1/jobs?city=<browser city>&pageSize=5` – posts in current city, falls back to other cities if none
- `GET /api/v1/searches/recent` – "Son Aramalarim" (logged-in users)

### Search Results (R3)
- `GET /api/v1/jobs/search?position=&country=&city=&town=&workingType=&page=&pageSize=`
- Filters returned in response body for badge UI; client removes via `X` and re-queries.

### Job Posting Detail (R4)
- `GET /api/v1/jobs/:id` – description, location, lastUpdated, applicationCount
- `GET /api/v1/jobs/:id/related` – minimum 3 related postings
- `POST /api/v1/jobs/:id/apply` – authenticated; non-auth users redirected to login client-side

### Notification Service (R5)
- `POST /api/v1/notifications/alerts` – create job posting alert (Iş Alarmı)
- Scheduled job (cron, hourly): pulls new postings from `new-job-postings` queue, matches user alerts, pushes notifications to `user-notifications` queue
- Scheduled job (nightly): scans user job searches in MongoDB and sends related postings notification

### AI Agent (R6)
- `POST /api/v1/ai/chat` – conversational endpoint using Anthropic Claude or Google Gemini; the agent calls the same REST APIs for search and apply (tool use)

## Non-Functional Requirements Coverage

- **NoSQL DB for searches** – MongoDB `userSearches` collection
- **Distributed cache for job postings** – Redis `job:<id>` keys with TTL 600s + `jobs:search:<hash>` for query cache
- **Versioned REST APIs** – all routes under `/api/v1/...`
- **Pagination** – `page` & `pageSize` query params with `total`, `pageCount` in response
- **IAM** – Supabase Auth (pluggable; local mock for dev)
- **Queue** – RabbitMQ (`new-job-postings`, `user-notifications` queues)
- **Cloud deployable** – every service has a Dockerfile + Azure App Service compatible config
- **No SQLite** – PostgreSQL for relational, MongoDB for NoSQL

## Data Models (ER)

### PostgreSQL – `jobs` (Job Posting Service)

```
jobs
├── id              UUID PK
├── company_id      UUID FK -> companies.id
├── title           VARCHAR(200)
├── description     TEXT
├── country         VARCHAR(80)
├── city            VARCHAR(80)
├── town            VARCHAR(80)
├── working_type    ENUM(fulltime, parttime, remote, hybrid, internship)
├── seniority       ENUM(junior, mid, senior, lead)
├── requirements    TEXT[]
├── application_count INT DEFAULT 0
├── last_updated    TIMESTAMPTZ
├── created_at      TIMESTAMPTZ
└── is_active       BOOLEAN DEFAULT true

companies
├── id              UUID PK
├── name            VARCHAR(120)
├── owner_user_id   VARCHAR(120)  -- IAM subject
└── created_at      TIMESTAMPTZ

applications
├── id              UUID PK
├── job_id          UUID FK -> jobs.id
├── user_id         VARCHAR(120) -- IAM subject
├── applied_at      TIMESTAMPTZ
└── UNIQUE(job_id, user_id)
```

### MongoDB – Job Search Service

```
userSearches (collection)
{
  _id: ObjectId,
  userId: "uuid-from-iam",
  position: "Web Developer",
  city: "Istanbul",
  country: "Turkey",
  town: "Kadikoy",
  workingType: "fulltime",
  searchedAt: ISODate
}
```

### MongoDB – Notification Service

```
jobAlerts (collection)
{
  _id: ObjectId,
  userId: "uuid",
  criteria: { position, city, country, workingType },
  channels: ["email"],
  createdAt: ISODate,
  active: true
}

notificationLog (collection)
{
  _id: ObjectId,
  userId: "uuid",
  type: "JOB_ALERT" | "RELATED_JOB",
  payload: { ... },
  sentAt: ISODate
}
```

### Redis Keys

```
job:<jobId>                     -> JSON job (TTL 600s)
jobs:search:<sha1(query)>       -> JSON paged result (TTL 60s)
autocomplete:position:<prefix>  -> ZSET ranked terms
autocomplete:city:<prefix>      -> ZSET ranked terms
```

## Local Development

```powershell
# 1. clone & enter
git clone <your-repo-url>
cd job-search-app

# 2. set env (copy .env.example to .env in each service)
copy .env.example .env

# 3. start everything via docker compose
docker compose up --build

# Frontend → http://localhost:5180
# API Gateway → http://localhost:8080
# RabbitMQ UI → http://localhost:15672 (guest/guest)
#
# NOT: Frontend 5180'de — 5173 Vite default'u baska uygulamalarla cakisabilir.
```

### Without Docker (dev mode)

```powershell
# each service in its own terminal
cd services/api-gateway      ; npm install ; npm run dev
cd services/job-posting-service   ; npm install ; npm run dev
cd services/job-search-service    ; npm install ; npm run dev
cd services/notification-service  ; npm install ; npm run dev
cd services/ai-agent-service      ; npm install ; npm run dev
cd frontend                  ; npm install ; npm run dev
```

## Cloud Deployment (Azure)

Each service has its own Dockerfile. Recommended layout:

| Component | Azure Service |
|--|--|
| API Gateway, all microservices | **Azure App Service for Containers** (one per service) or Azure Container Apps |
| Frontend | **Azure Static Web Apps** or App Service |
| PostgreSQL | **Azure Database for PostgreSQL Flexible Server** |
| MongoDB | **Azure Cosmos DB for MongoDB API** |
| Redis | **Azure Cache for Redis** |
| Queue | **Azure Service Bus** (drop-in for RabbitMQ via amqp 1.0) or RabbitMQ on Container Apps |
| Scheduler | **Azure Logic Apps** triggering the notification service HTTP endpoints |
| IAM | **Supabase Auth** (managed) |

Steps:

1. Push images to Azure Container Registry.
2. Create App Services pointing to each image; configure env vars from the `.env.example` files.
3. Create the databases and copy the connection strings into each App Service's configuration.
4. Set up Logic Apps with two recurrence triggers (hourly & daily) hitting the notification service's `/internal/run-*` endpoints with a secret header.
5. Update the frontend `VITE_API_BASE` to the API Gateway URL.

## Assumptions

- Browser geolocation is treated as **provided**; the client may fall back to a default city (`Istanbul`) if denied.
- Image uploads for company logos are out of scope.
- AI Agent supports Anthropic Claude (`ANTHROPIC_API_KEY`) and Google Gemini (`GEMINI_API_KEY` or `GOOGLE_API_KEY`) with tool-use. Anthropic is preferred when both keys are set. Without a key, the service returns a static demo response so the UI still works.
- IAM is mocked locally: any JWT with header `Authorization: Bearer dev-<role>-<userId>` is accepted in `NODE_ENV=development`. In production, Supabase JWKS verifies tokens.
- Scheduled tasks are triggered by `node-cron` inside the notification service for local dev, and by Logic Apps in production (both call the same `runJobAlerts()` / `runRelatedJobs()` handlers).
- Real-time messaging in the AI chat is not required (per spec); responses are request/response only.

## Known Issues / Limitations

- Distributed tracing is not wired up (would use OpenTelemetry in production).
- No retry/dead-letter on RabbitMQ consumer beyond default behaviour.
- AI Agent tool-use loop is simplified – maximum 3 tool-use rounds per user turn.

## Tech Stack

- **Backend:** Node.js 20, Express 4
- **Frontend:** React 18, Vite, Tailwind CSS, React Router 6
- **Databases:** PostgreSQL 16, MongoDB 7, Redis 7
- **Queue:** RabbitMQ 3 (amqplib)
- **Scheduler:** node-cron (local) / Azure Logic Apps (cloud)
- **IAM:** Supabase Auth
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`) or Google Gemini REST API
- **Container:** Docker, docker-compose

## Folder Structure

```
job-search-app/
├── README.md
├── docker-compose.yml
├── .gitignore
├── services/
│   ├── api-gateway/
│   ├── job-posting-service/
│   ├── job-search-service/
│   ├── notification-service/
│   └── ai-agent-service/
└── frontend/
```
