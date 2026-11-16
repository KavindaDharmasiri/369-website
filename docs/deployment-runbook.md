# Vercel deployment and rollback runbook

This is a draft operating procedure. It has not been exercised against a live Vercel deployment
in this repository session. Use it with the database-specific procedure in
[`database-migration-runbook.md`](database-migration-runbook.md) and the approved
secret/backup policy for the target environment.

## Preconditions

- A recent, tested backup/restore of the target PostgreSQL database.
- The reviewed forward migrations (`202611130001_schema_parity`,
  `202611130002_order_requests`) applied to a disposable clone and an isolated restore.
- A successful `npx prisma generate` on the deployment platform.
- The committed lockfile and a supported Node runtime for the Vercel project.
- Approved values for `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`,
  `NEXT_PUBLIC_ENCRYPTION_KEY`, and Cloudinary credentials, set in Vercel. Never commit them.
- Any external caller of `POST /api/orders` updated to send a stable `Idempotency-Key`.
- For Neon or another pooled PostgreSQL provider, use the direct (non-pooled) connection string
  for migrations and the pooled connection string for the application, if the provider requires
  that split.

## Build and release order

1. Run the local/CI checks:
   ```bash
   npm ci
   npx prisma generate
   npm test
   npx tsc --noEmit --incremental false
   npm run check:migrations
   npm run build
   ```
2. Apply migrations as a separate step, before deploying receipt-dependent application code:
   ```bash
   npx prisma migrate deploy
   ```
   Run this from an approved release environment with the production/direct database URL.
   Confirm the applied migration list and that no historical migration was rewritten.
3. Deploy the reviewed commit through Vercel. The build command is `npm run build`;
   `postinstall` generates the Prisma client and prepares try-on assets. Vercel must not run
   migrations automatically on every build.
4. Check readiness (`GET /api/health` returns 200 and a minimal body). A 503 means a required
   dependency is unavailable; do not route traffic until it is resolved.
   Readiness responses have a 2-second application deadline and coalesce concurrent
   database probes per process. This deadline does not cancel an in-flight driver
   query: configure bounded connection/pool timeouts too. `GET /api/health/live`
   is dependency-free liveness, not evidence that checkout is ready.

## Smoke tests

- Sign in and load a cart with a real variant.
- Place an order with a known `Idempotency-Key`; retry the same request and confirm the same
  order, no second stock deduction, and `Idempotency-Replayed: true`.
- Change one payload field under the same key and confirm `409 IDEMPOTENCY_CONFLICT`.
- Resolve an earlier attempt and confirm it either returns the completed order or retires the
  identity without cancelling an order.
- Confirm invalid/missing keys return 400, private responses carry `Cache-Control: private,
  no-store`, and another user cannot read or resolve the order.
- Verify order history, owner-scoped order details, PDF, and admin order visibility.
- Check Vercel/runtime logs for receipt conflicts, null-response receipts, repeated
  notifications, function timeouts, and inventory/coupon discrepancies.
- Verify the order function duration limit is compatible with the transaction budget; raise it
  only after measuring representative cart/catalog sizes.

## Rollback

- Use Vercel's deployment rollback/promotion controls to return to a compatible build.
- Preserve the `order_requests` table and all successful/abandoned identities. Do not drop it
  to run an older application version.
- If the previous build does not enforce idempotency, disable new order creation during the
  rollback window so retries cannot create duplicates.
- Restore the database only through the rehearsed, approved procedure, accounting for orders
  accepted after the backup. Do not assume a restore is safe merely because it completes.
- Keep legacy URL redirects and SEO-critical routes active across an application rollback.

## Operations

- Alert on order failures, duplicate/idempotency conflicts, negative inventory, unexpected
  price/tax changes, receipt anomalies, readiness failures, database pool pressure, and slow
  order transactions.
- Rotate any secret that may have been exposed; keep real secrets server-only.
- Server API exceptions now use allowlisted JSON error records with incident IDs;
  raw error messages/SQL/provider payloads are omitted and raw Prisma error events
  are disabled. Production compilation retains `console.error`. Wire these records
  into the approved external logging/alerting sink before a release; local JSON logs
  do not establish hosted retention, alerts, or incident-response readiness.
- Retain receipt records for at least the accepted retry window. Do not delete an identity
  while a retry can still arrive; archival/expiry must not allow an old key to create another
  order.
