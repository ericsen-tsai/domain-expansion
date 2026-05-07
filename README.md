# TanStack Start + Maps Domain Scaffold

This project lets you:

- Require a simple **app passphrase** (`APP_PASSPHRASE`) before using the UI; session is stored in an HttpOnly cookie.
- Save **four coordinates** (idx 0–3) in Postgres.
- Draw a polygon (“domain”) on Google Maps using those coordinates.
- Search places (Google Places Autocomplete) and check if a place falls **inside** the domain polygon.
- **Save searched places as collections** (name + memo, editable), list them, and show them as markers on the map.
- Update each coordinate via a simple authed endpoint (shared secret in env).

## Prereqs

- Node.js **20.19+** (Vite requires this; 22.12+ also works)
- `pnpm`
- Docker Desktop (for local Postgres)

## Setup

Copy env and fill in values:

```bash
cp .env.example .env
```

Start Postgres:

```bash
docker compose up -d
```

Run DB migrations + seed the 4 default vertices:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the app:

```bash
pnpm dev
```

Open:

- `http://127.0.0.1:3000/` (redirects to `/login` until you sign in with `APP_PASSPHRASE`)

## Environment variables

- `DATABASE_URL`
  - Default local dev uses **port 5433** to avoid clashing with a host Postgres on 5432.
- `VITE_GOOGLE_MAPS_API_KEY`
  - Must have Maps JavaScript API enabled
  - Must have Places API enabled
  - (Recommended) restrict by HTTP referrer in Google Cloud Console
- `DOMAIN_SECRET`
  - Shared secret for vertex updates (in addition to the logged-in session cookie).
- `APP_PASSPHRASE`
  - Passphrase for `POST /api/auth/login` and for opening the app; signing key for the session cookie is derived from it.

## API

### Auth (no session cookie required)

- `POST /api/auth/login` — body `{ "passphrase": "<APP_PASSPHRASE>" }`; sets `app_session` cookie.
- `POST /api/auth/logout` — clears the session cookie.
- `GET /api/auth/me` — `{ "authenticated": true | false }`.

### GET `/api/domain`

Requires a valid `app_session` cookie (same browser session as the UI).

Returns:

```json
{ "vertices": [ { "idx": 0, "lat": 0, "lng": 0 }, { "idx": 1, "lat": 0, "lng": 0 }, { "idx": 2, "lat": 0, "lng": 0 }, { "idx": 3, "lat": 0, "lng": 0 } ] }
```

### PUT `/api/domain/vertex/:idx`

- `idx` must be 0–3
- body: `{ "lat": number, "lng": number }`
- auth: valid `app_session` cookie **and** header `x-domain-secret: <DOMAIN_SECRET>` (or `Authorization: Bearer <DOMAIN_SECRET>`)

Example:

```bash
curl -c cookies.txt -X POST "http://127.0.0.1:3000/api/auth/login" \
  -H "content-type: application/json" \
  --data '{"passphrase":"replace_me"}'

curl -b cookies.txt "http://127.0.0.1:3000/api/domain"

curl -b cookies.txt -X PUT "http://127.0.0.1:3000/api/domain/vertex/0" \
  -H "content-type: application/json" \
  -H "x-domain-secret: replace_me" \
  --data '{"lat":25.034,"lng":121.564}'
```

### Collections (session cookie required)

- `GET /api/collections` — list collections.
- `POST /api/collections` — body `{ "name": string, "memo"?: string, "lat": number, "lng": number }`.
- `PATCH /api/collections/:id` — body `{ "name"?: string, "memo"?: string }` (at least one field).

## Tooling

- Lint:

```bash
pnpm lint
```

- Husky hooks:
  - `pre-commit`: runs `lint-staged` (oxlint)
  - `commit-msg`: runs commitlint (conventional commits)
