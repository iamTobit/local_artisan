# Local Artisan

Local Artisan is a full-stack marketplace that connects customers with local service professionals. Customers can find artisans, review profiles and services, book available time slots, and save profiles. Artisans manage their profiles, service catalogs, and availability. Administrators handle verification and marketplace operations.

The repository is a monorepo with two independently run applications:

- **Client:** React and TypeScript, built with Vite and TanStack Start. It uses Tailwind CSS for styling and communicates with the API over HTTP.
- **API:** Python and Flask REST API, backed by PostgreSQL. Redis supports production caching and Celery task infrastructure.

The client is not a Node.js API server. Vite runs the client development and build workflow; Flask serves the backend API.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Web client | React 19, TypeScript, Vite 8, TanStack Start and Router |
| Styling and UI | Tailwind CSS 4, Radix UI, Lucide icons |
| Client data and forms | TanStack Query, React Hook Form, Zod |
| Client testing | Vitest, Testing Library, jsdom |
| Backend API | Python 3.11+, Flask, Flask-SQLAlchemy, Marshmallow |
| Persistence and migrations | PostgreSQL, SQLAlchemy, Flask-Migrate/Alembic |
| Background tasks and cache | Celery, Redis |
| Payments and uploads | M-Pesa integration configuration, Pillow, local development uploads |

## Repository Structure

```text
.
├── client/                 # React application, tests, and Vite/TanStack configuration
│   ├── public/             # Static client assets
│   └── src/
│       ├── components/     # Shared UI and marketplace screens
│       ├── hooks/          # React hooks
│       ├── lib/local/      # Typed API client and client-side services
│       ├── routes/         # File-based application routes
│       └── test/           # Client tests
├── server/                 # Flask REST API and Python dependencies
│   ├── app/                # API modules, models, schemas, and services
│   ├── migrations/         # Alembic migration history
│   └── tests/              # Backend tests
└── README.md
```

## Prerequisites

- Git
- Node.js 22 or newer and npm (or Bun, using the checked-in Bun lockfile) for the client
- Python 3.11 or newer for the API
- PostgreSQL for application data
- Redis for production/staging cache and Celery broker configuration; local development defaults Celery to `localhost:6379`

## Run Locally

Set up the API and its database first using the [server setup guide](./server/README.md). Then start the client:

```bash
cd client
npm ci
cp .env.example .env
npm run dev
```

By default, the client uses `http://127.0.0.1:5000/api`. Change `VITE_API_BASE_URL` in `client/.env` if the API is hosted elsewhere. Start the API separately by following the [server setup guide](./server/README.md).

## Documentation

- [Client setup, commands, and structure](./client/README.md)
- [API setup, environment, and operations](./server/README.md)
