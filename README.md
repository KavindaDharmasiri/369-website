# 369 Website

Full-stack Next.js (App Router) clothing shop with SSR, PostgreSQL/Prisma, Cloudinary uploads, and an admin dashboard.

## Getting Started

1. Install dependencies (use the committed lockfile):
```bash
npm ci
```

2. Set up environment variables — copy `.env.example` to `.env.local` and fill in real values:
```bash
copy .env.example .env.local
```
Required: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_ENCRYPTION_KEY`, and the `CLOUDINARY_*` keys.
`NEXT_PUBLIC_ENCRYPTION_KEY` must equal `ENCRYPTION_KEY`; the shared browser AES layer is not a security boundary and is tracked for migration.

3. Apply the committed database migrations:
```bash
npm run db:deploy
```
Use `npx prisma migrate dev` only when creating/reviewing a new migration in development.
Do **not** use `prisma db push` for production or for a database with existing data. Read
[`docs/database-migration-runbook.md`](docs/database-migration-runbook.md) before applying
the forward parity/receipt migrations, especially if the database was previously managed with
`db push`. No migration is applied automatically by the application.
Database scripts load `.env.local` without printing values and use the direct
connection (`DIRECT_DATABASE_URL`, or the equivalent non-pooled Neon hostname).
Session-level migration locks and search paths must not run through a transaction pooler.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Checks

```bash
npm test                     # offline handler/helper regression suite
npm run lint
npm run check:migrations     # offline structural SQL comparison; no database contact
npm run typecheck
npm run build
```

`npm test` and `npm run check:migrations` do not prove PostgreSQL concurrency, migration
execution, browser behavior, or deployment success. See [`tests/README.md`](tests/README.md)
and [`SYSTEM_REMEDIATION_AND_SEO_ROADMAP.md`](SYSTEM_REMEDIATION_AND_SEO_ROADMAP.md) for the
remaining verification gates.

With authorization to create/drop a uniquely named temporary schema on the configured
database, run `npm run test:postgres`. It migrates that new schema, creates only synthetic
fixtures, runs concurrency/rollback tests, and removes that exact schema in cleanup.
It never seeds customer tables and is not a backup/restore or browser test. Use
`npm run db:status` / `npm run db:diff` for read-only direct-connection schema checks.

## Deployment (Vercel)

This project deploys to Vercel.

1. Set the production environment variables in Vercel (`DATABASE_URL`, `JWT_SECRET`,
   `ENCRYPTION_KEY`, `NEXT_PUBLIC_ENCRYPTION_KEY`, Cloudinary keys, and any try-on provider
   values). Never commit them.
2. Run `npx prisma migrate deploy` as a separate release step against the production database
   before deploying receipt-dependent code. Do not run migrations automatically on every
   Vercel build; concurrent builds can race.
3. Deploy the repository through Vercel. `npm run build` is the build command; `postinstall`
   generates the Prisma client and prepares try-on assets.
4. Verify `GET /api/health` returns 200 and run the smoke tests in
   [`docs/deployment-runbook.md`](docs/deployment-runbook.md).

Vercel deployment remains unverified and is explicitly out of the current work scope.
Migration/application and test evidence is recorded in the roadmap; it is not proof of
a deployed release. See the runbooks before a production release.

## Project Structure

- `src/app/` - Frontend pages and layouts
- `src/app/api/` - Backend API routes
- `src/lib/` - Shared utilities (auth, db, encryption)
- `src/components/` - Reusable UI components
- `prisma/` - Database schema and migrations
- `docs/` - Checkout contract and database rollout runbook
- `tests/` - Offline regression suite and test limitations

## Features

- Customer: shop, category pages (women/men), product detail, cart, checkout, order history, address book
- Admin: dashboard, product/SKU/spec management, categories, subcategories, orders
- JWT authentication with signature-verified middleware
- Cloudinary image uploads, PDF invoices, audit trail
- Durable, user-scoped order idempotency: `POST /api/orders` requires an `Idempotency-Key` header

## Notes

- `.env` / `.env.local` are gitignored — never commit real secrets. Rotate any secret that has been committed.
- On Windows, stop any running dev/build process before `npx prisma generate`; a loaded query-engine DLL can cause `EPERM` during replacement.
- Development uses `.next-dev`, production builds use `.next`, and `tsconfig.build.json`
  excludes transient dev-generated types. Do not run two production builds/servers against
  the same `.next` output while rebuilding it.
- Checkout callers must supply a valid `Idempotency-Key` and retain it across retries; see
  [`docs/checkout-safety-contract.md`](docs/checkout-safety-contract.md).
