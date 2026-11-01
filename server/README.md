# Local Artisan API

The backend is a Python Flask REST API for the Local Artisan marketplace. It owns authentication and authorization, persists marketplace data in PostgreSQL, and exposes endpoints for accounts, artisan services, search, bookings, reviews, and administration. The React client runs separately and calls this API.

## Requirements

- Python 3.11 or newer
- PostgreSQL
- Redis for production/staging caching and Celery task processing

## Install

From the repository root:

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

Create a PostgreSQL database and update `server/.env` with its connection URL and unique secret values. URL-encode special characters in database credentials.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `SECRET_KEY` | Flask application secret; use a long, random value |
| `JWT_SECRET_KEY` | JWT signing secret; use a different random value from `SECRET_KEY` |
| `DATABASE_URL` | PostgreSQL SQLAlchemy connection URL |
| `JWT_ACCESS_TOKENS_EXPIRES_DAYS` | Access-token lifetime in days (defaults to `7`) |
| `REDIS_URL` | Redis cache URL for staging/production |
| `CELERY_BROKER_URL` | Celery broker URL (defaults to `redis://localhost:6379/0`) |
| `CELERY_RESULT_BACKEND` | Celery result backend URL (defaults to `redis://localhost:6379/0`) |
| `BCRYPT_ROUNDS` | Password hash work factor (defaults to `10`) |
| `BUSINESS_HOURS_START`, `BUSINESS_HOURS_END` | Business-hour range (defaults to `8` and `18`) |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Optional initial administrator seed credentials |
| `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | M-Pesa integration settings |

`FLASK_APP=wsgi:app` identifies the application entry point. The current development command specifies it explicitly, so setting `FLASK_APP` in `.env` is optional. Do not commit `.env` or use development secrets in a deployed environment.

Generate separate secrets with:

```bash
python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

## Database Setup and Development

Run these commands from `server/` with the virtual environment active:

```bash
python -m flask --app wsgi:app db upgrade
python -m flask --app wsgi:app db-seed-all
python -m flask --app wsgi:app db-seed-admin
python -m flask --app wsgi:app run --debug
```

The API listens at `http://127.0.0.1:5000`. Health endpoints are `/` and `/health`. The admin seed command prompts for missing credentials; set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` to seed non-interactively.

For an existing database that already contains counties, seed subcounties separately:

```bash
python -m flask --app wsgi:app db-seed-subcounties
```

The bundled subcounty records are a practical starting dataset, not an exhaustive official directory. Verify names and boundaries against authoritative sources before production use.

## API Areas

| Prefix | Purpose |
| --- | --- |
| `/api/auth` | Registration, login, account and profile management |
| `/api/locations` | Counties and subcounties |
| `/api/artisan` | Artisan onboarding, profile, photos, and service management |
| `/api/marketplace` | Service search, public profiles and reviews, saved artisans, contact links |
| `/api/bookings` | Availability and booking workflows |
| `/api/operations` | Payments, reviews, and disputes |
| `/api/admin` | Dashboard, artisan verification, account actions, and dispute resolution |

Authenticated routes use bearer tokens. Registration supports customer and artisan accounts; create the initial administrator with `db-seed-admin`.

## Useful Marketplace Behaviors

- Public profiles include a verified artisan's services, work-photo URLs, and calculated trust statistics. A profile without reviews has `average_rating: null` and `review_count: 0`.
- Public reviews are paginated at `/api/marketplace/artisans/{artisan_id}/reviews`.
- Artisans manage services through `/api/artisan/services` and work photos through `/api/artisan/profile/work-photos`. Profiles support up to 10 gallery photos.
- Search accepts county/subcounty filters and optional `latitude`, `longitude`, and `radius_km` parameters. Radius searches are limited to 500 km.
- Booking creation requires an artisan, one of that artisan's services, and an open availability slot. Cancelling a booking releases the slot.
- Customers can save and remove verified artisan profiles through `/api/marketplace/saved-artisans`.

## Background Worker

The Celery application is defined in `celery_worker.py`. With Redis running and the environment active, start a worker from `server/` with:

```bash
celery -A celery_worker.celery worker --loglevel=info
```

## Uploads and Deployment

Artisan profile images are stored under `app/static/uploads/artisans/` for local development and served as static files. Production deployments should configure durable shared object storage. `flask run` is a development server; use a production WSGI server for deployment and configure secrets, PostgreSQL, Redis, worker processes, and storage for each environment.
