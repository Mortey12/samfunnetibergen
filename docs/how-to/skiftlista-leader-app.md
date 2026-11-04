# Skiftlista leader app

The page where bar leaders see wishes and place people on shifts. It is a Svelte
5 and Vite single-page app in `apps/internal/skiftlista`. The backend stays in
the separate `kvarteret-personal` repository; this app only talks to Personal's
leader API. The app's own `README.md` describes the code layout and what to try;
this guide covers running, checking, hosting and seeding.

## Run it

```bash
npm ci
npm run dev:skiftlista        # http://localhost:3190
```

By default the app runs on invented data (`src/core/fake.ts`) and needs no
backend. To read and write real data, run Personal locally and open
`http://localhost:3190/?api=http` after logging in at Personal. The dev server
proxies `/personal/*`, `/login`, `/logout` and `/static/*` to `PERSONAL_URL`
(default `http://localhost:8000`), so the browser sees one origin. A local
Personal needs `LEADER_APP_ORIGINS=http://localhost:3190` in its `.env`.

## Checks

```bash
npm run typecheck:skiftlista
npm run test:skiftlista
npm run build:skiftlista
npx --no-install biome check apps/internal/skiftlista
```

The root `typecheck`, `test`, `build`, `lint` and `format:check` scripts include
the app, and CI builds it when `apps/internal/skiftlista`, `package.json` or the
lockfile change. The Playwright tests (`npm --workspace @samfunnet/skiftlista
run test:e2e`) are not in CI yet.

## Who can use it

The app is static and holds no secrets. Access control lives in Personal
(`app/api/v1/leader_shifts.py`, `leader_write_guard.py`):

- Reading and writing need a logged-in Admin or Gruppeadmin. A Gruppeadmin sees
  and changes only the bars in their scope.
- Every write must come from an origin listed in Personal's
  `LEADER_APP_ORIGINS` (plain `https://host` origins; HTTPS is required in
  production), carry the `X-CSRF-Token` from `GET /me`, and send the week's
  `If-Match` version.

Serving the page publicly therefore exposes no data, but the page and Personal
must share one origin so the login cookie works. For previews, also turn on
Vercel Deployment Protection so only team members can open them.

## Host it on Vercel

The app deploys as its own Vercel project, like Studio:

- Root Directory `apps/internal/skiftlista`, with source files outside the root
  enabled so the npm workspace installs.
- `vercel.json` in the app pins `npm run build`, the `dist` output and the
  single-page fallback. Keep it checked in.
- Build variable `VITE_LEADER_API=http` makes the build use Personal instead of
  invented data.
- The same origin must also serve `/personal/*`, `/login`, `/logout` and
  `/static/*` from Personal. `demo/vercel.json` shows the rewrite shape, with
  the destination pointing at the old Render demo.

Open decisions (not settled in this repository):

- **Where the rewrites point per environment.** Vercel rewrites in `vercel.json`
  cannot read environment variables, so previews and production need separate
  configs or a small proxy function.
- **Preview origins.** `LEADER_APP_ORIGINS` is an exact match and preview URLs
  change per deployment, so previews need a stable alias or domain.
- **Secrets.** How the project's variables are stored and who sets them.

## Seed data

The seed scripts live in `kvarteret-personal/scripts/dev/`: `seed_synthetic.py`
(people and groups), `seed_shifts.py` (bars, shift templates and shifts),
`seed_demo.py` (demo people, wishes, courses, statuses and a demo leader login)
and `bootstrap.py` (runs the first two for local development). The data is fake
and relative to the date it was seeded, so an old database needs seeding again.

Every one of these scripts refuses a hosted database unless
`DEMO_SEED_CONFIRM` is set to exactly the database's host name. Local
databases (`localhost`, `127.0.0.1`) need nothing. The check cannot tell which
hosted database is production, so never confirm a production host. Use it only
for a demo or preview database that holds fake data.

## Production

Nothing here touches production. A preview must point at a non-production
Personal and database, with a non-production token. Do not copy production
credentials into a preview.
