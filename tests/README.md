# Offline regression tests

## Real PostgreSQL tests (separate opt-in command)

`npm run test:postgres` creates, migrates, exercises and drops only a newly generated
`verify_369_*` schema on the explicitly authorized DB. Synthetic cart/order fixtures
must never enter public/customer tables; the harness checks qualified ORM SQL first.
Tests cover fresh migrations, concurrent durable imports/order receipts, nullable SKU
uniqueness, revisions/ABA edits, conditional checkout clearing, final stock/coupon
races, transaction rollback, and the quote contract (missing/expired quote,
`QUOTE_CHANGED` rollback, replay after quote expiry). New-client replay is tested;
actual process crash, full backup/restore, production load, browser, and provider
behavior are not implied.
See `docs/postgres-verification.md` for direct connections and evidence.

## Offline suite

Run `npm test` from the repository root after dependencies are installed.

The suite uses Node's built-in test runner and the existing TypeScript compiler;
no new test framework or service account is required. The loader transpiles the
actual application modules and keeps one module cache per test environment.
It refuses accidental imports of the real database or authentication module.

Database/auth/encryption doubles are explicit. The settings-operation double is
lazy, like a PrismaPromise, so the test can check validation-before-write and
simulate the array-transaction API. Order transactions restore their simulated
state on failure. Those mechanics do **not** prove PostgreSQL rollback/isolation.

Covered: request validation, trusted order snapshots, required variants,
duplicate-line consolidation, conditional stock/coupon query intent, simulated
reservation failure and rollback, safe profile fields, promotion partial updates,
zero numeric settings, minimal readiness responses, and selection-order-independent
variant lookup. The existing success/encryption envelopes are retained.

The second batch also covers progressive guest import, nonempty account bags,
rejected lines, uncertain/lost responses, persisted replay guards across module
reloads, local storage errors, detected concurrent changes, session changes, safe
saved-line removal, same-tab lock queuing, stale coupon-response invalidation,
parallel checkout resource startup/settlement, text-only confirmations, payment
labels, coupon preview validation, and private owner-scoped order detail reads.
These are handler/helper tests, not browser or cross-tab integration tests.

The third batch covers mandatory idempotency-key validation, canonical payload
hashing, successful replay without new stock/coupon/cart writes or notifications,
same-key/different-payload conflicts, failed-transaction receipt rollback, the
authenticated owner-scoped resolution endpoint, abandoned-identity blocking,
browser attempt persistence/reuse/clearing, and structural forward-migration
coverage. Its concurrency tests use an explicit in-memory unique-index/transaction
double; they do **not** establish PostgreSQL unique-index waiting, isolation,
deadlock/timeout behavior, migration execution, or restore behavior.

The fourth batch covers exact minor-unit money arithmetic, purpose-separated quote
signing/verification, owner/input/expiry binding, `QUOTE_REQUIRED`/`QUOTE_EXPIRED`/
`QUOTE_CHANGED`, replay of a committed receipt after quote expiry, server-quote
parsing and cent-exact total comparison, and the changed-total review text. The
quote is verified before any new-order write and is excluded from the durable order
fingerprint.

Still required before production sign-off:

- Complete deadlock/timeout/load, sanitized existing-data upgrade and backup/restore
  verification beyond the available isolated-schema PostgreSQL checks.
- Deployment-platform Prisma generation and release verification; local generation
  and authorized migration application have since succeeded.
- Browser tests for rapid product navigation, SKU-only catalogs, changing options in
  either order, failed option loading/retry, guest/authenticated add-to-cart, saved
  checkout attempts, uncertain responses, and explicit resolution.
- API authorization/role/revocation, full decimal/tax-policy, provider failure,
  deployment/migration, performance, and SEO suites from the roadmap.

Never run fixture cleanup or destructive tests against public/customer tables. The
opt-in harness may use an authorized database only through its guarded new schema.
