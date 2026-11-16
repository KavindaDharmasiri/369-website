# Database and order-identity rollout runbook

## Current evidence and stop conditions

- With explicit user confirmation, the configured production PostgreSQL database was
  inspected and updated in this session: migration status reported `0_init`,
  `202611130001_schema_parity`, and `202611130002_order_requests` as not yet applied, while
  a schema diff showed only `order_requests` missing. `0_init` and the parity migration were
  therefore baselined with `prisma migrate resolve --applied`, and
  `202611130002_order_requests` was applied via `prisma migrate deploy`. Final migration
  status is up to date and the schema diff is empty. No destructive reset was performed.
- This was **not** a disposable-clone rehearsal and does not replace data-upgrade,
  concurrency, rollback, or restore verification. Treat future migration changes as requiring
  isolated rehearsal before production apply.
- `npm run check:migrations` renders the target schema OFFLINE and compares the repository's
  SQL table/column/index/FK declarations. It is not PostgreSQL execution, introspection,
  a primary-key/trigger/permission audit, a data validation, or proof the SQL runs.
- Windows `prisma generate` encountered EPERM replacing a locked query-engine DLL during this
  session (including after migration apply). Do not kill unknown Node processes or work around
  this with `--no-engine` (that targets Accelerate). Stop local dev/build processes holding the
  DLL and rerun `npx prisma generate`; a successful type/build does not erase the generation
  failure.

Do not deploy receipt-dependent application code until the real database, migrations,
generated client and supported runtime have been verified together.

## Forward migrations

1. `0_init`: existing history; intentionally unchanged.
2. `202611130001_schema_parity`: five profile columns, order coupon/discount fields,
   original item price, ten missing application tables, missing indexes/FKs, and uppercase
   default for new order statuses. It does NOT rewrite existing status/history data.
3. `202611130002_order_requests`: durable per-user checkout identities, response snapshots,
   user/order references, unique user/key identity, unique completed order reference.

Both new scripts use explicit transactions. The added FKs can reject historical orphans;
new unique indexes may reject conflicting data on databases already containing these objects.
No migration silently deletes, deduplicates, or invents historical customer/order information.

## Establish the actual starting state first

Confirm database identity, hosting region, application version, migration history, actual
tables/columns/defaults/indexes/FKs, privileges, pool limits, backup age and maintenance window.
Use credentials through approved environment/secrets handling; never paste a real URL into
Git or diagnostic logs. Prisma CLI environment loading is not identical to Next's `.env.local`:
explicitly supply the approved `DATABASE_URL` for the intended disposable/clone database.

### A. Empty disposable database

On a confirmed disposable PostgreSQL instance, run `npx prisma migrate deploy` with that
database's environment, followed by `npx prisma generate`. Validate seed/test fixtures without
production default credentials. Compare the actual database schema to `prisma/schema.prisma`.
Only then run real integration tests. This session has not run those deployment commands.

### B. Database matching only the historical 0_init

Restore a recent backup into an isolated clone. Run the read-only baseline checks in
`prisma/preflight/schema-parity.sql`. Review every nonzero result; repair with an approved,
auditable plan, not automatic deletes. Rehearse applying both new migrations to the clone.
Check lock duration, data preservation, defaults, FK actions, client compatibility and restore.
Repeat only the reviewed process in the production maintenance window after authorization.

### C. Database managed with db push or manual changes

**Do not blindly run migrate deploy or mark all migrations as applied.** The parity script
deliberately uses CREATE/ADD, not blanket IF NOT EXISTS that could conceal incompatible objects.
An already-current schema would encounter duplicate-object errors.

On the clone, inspect and compare the actual objects to the exact intended pre-receipt schema.
If and only if an operator proves all objects represented by an unapplied historical/parity
migration already exist with the correct definitions and data constraints, they may baseline
that exact migration using Prisma's reviewed `migrate resolve --applied <migration>` workflow.
Do not mark the order-request migration applied unless those objects are separately verified.
For partial/unknown drift, prepare a tailored forward repair plan rather than pretending a
partial migration is applied. Retain evidence, SQL and baseline decisions with the release.

## Required real-PostgreSQL acceptance cases

- Empty install and sanitized existing-data upgrade produce the same intended schema.
- Twenty simultaneous unique-key one-unit orders against stock five yield exactly five
  successes, no negative stock, and correct items/cart/coupon totals.
- Twenty simultaneous requests with one user/key/fingerprint yield one order, one inventory
  deduction, one coupon redemption, and the same response for all successful retries.
- Same key/different payload returns conflict; different users can reuse the same opaque key.
- After commit, change stock/prices/promotions and order status; replay must return the stored
  initial response without reading/revalidating stock or clearing a newly populated cart.
- Pause a first transaction after receipt insertion; its duplicate must wait at the unique
  index, not reach stock/coupon work. Commit first and verify replay; roll back first and
  verify a waiting request can acquire the identity and create at most one order.
- A resolution request racing an in-flight order either returns that order or commits an
  abandoned identity. A late order with an abandoned identity cannot create an order.
- Inject failure after stock reservation, after order creation, and during receipt completion:
  roll back all changes, including the initial receipt. No committed null-response receipt.
- Inject unique order-number failures, pool waits, transaction timeouts, connection failures
  and deadlocks; no unrelated unique error may be mistaken for a replay. Retain the client key
  on unknown outcomes. Retest transaction time budgets under representative catalog/cart sizes.

## Pending local migrations (not applied)

- `prisma/migrations/202611130003_slugs/migration.sql` adds nullable `slug` columns/indexes for products, categories, and subcategories (S02 groundwork). **Do not apply to production without review/rehearsal.**
- `prisma/migrations/202611130004_slug_redirects/migration.sql` adds `slug_redirects` table groundwork for retired URL mappings (S02/S04). **Not applied.**
- `prisma/migrations/202611130005_session_version/migration.sql` adds `users.session_version` for R14 session revocation/versioning groundwork. **Not applied.**
- Before/with application: generate Prisma client on a platform/build that can write the engine (`npx prisma generate` is currently blocked locally by a locked Windows DLL in this environment), run safe data backfill (`npm run db:backfill-slugs`) only after slug columns exist and on verified data, and implement slug history/redirect record creation + resolution before any slug-based URL/canonical cutover or slug renames. Session revocation/version bump behavior must be implemented and deployed consistently with session-version-aware auth.
- Treat slug/redirect/session-version rollout as additive schema + controlled compatibility period; legacy ID URLs and existing sessions must keep working safely during transition.

## Application rollout and rollback

1. Complete backup/restore and clone rehearsals; obtain production maintenance approval.
2. Apply reviewed additive schema changes before application code using the new tables/columns.
3. Generate the client successfully on the deployment platform with the approved lockfile.
4. Deploy backend and storefront together where API contracts change: order POST now REQUIRES `Idempotency-Key`. Update any other callers/collections; unknown external consumers are not verified here.
5. Smoke-test new order, unchanged replay, changed-payload conflict, identity resolution, declined/invalid input, owner isolation, history and PDF. Check private/no-store headers.
6. Monitor order/receipt counts, orphan/null-response receipts, unique conflicts, slow transactions, repeated notifications, failed requests and inventory/coupon discrepancies.

Rollback must preserve the order_requests table and its successful/abandoned identities.
Never drop it to restore an older app. Disable new orders during rollback to a version that
does not enforce these identities: that old code could create duplicates when clients retry.
Prefer a compatible application rollback or forward fix. Restore the database only through
the rehearsed approved procedure, accounting for orders accepted since the backup.

No automatic receipt cleanup is provided. Choose retention based on accepted retry windows
and historical integrity before designing archival; expiry must not allow an old key to create
another order. Stored hashes do not contain raw delivery details; they remain user-associated
records and require appropriate access/privacy/retention treatment.
