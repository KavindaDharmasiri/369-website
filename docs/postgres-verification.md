# PostgreSQL verification and cart rollout

`npm run test:postgres` is opt-in and creates a random `verify_369_*` schema on the
authorized database. It applies the complete migration chain, verifies that Prisma
ORM queries explicitly target that schema before inserting synthetic fixtures,
and drops only that generated schema in `finally`. It never accepts a schema name
from the command line. It is not a production backup/restore rehearsal, load test,
provider simulation, or browser test. Authentication/notification adapters in the
route-level checks are test substitutes; PostgreSQL/transaction logic is real.

Use direct connections for migrations and this harness. Transaction-pooler sessions
can retain a migration advisory lock or a temporary search path after clients exit.
That caused a migration timeout and a misleading pooled migration-status result
during investigation. Direct-connection status/diff showed the actual public schema
up to date. No customer data was deleted to correct that diagnostic. The initial
harness used the pooler; the final harness uses direct sessions and keeps migration
locking enabled. A raw `current_schema()` is not proof of the namespace Prisma uses
for ORM queries; the harness checks their qualified SQL before writing fixtures.
The final expanded run passed **21/21** checks, including real order-route concurrent
retry, changed-payload conflicts, stock/cart writes, owner-scoped order lists, and the
quote contract: a missing quote returns `428 QUOTE_REQUIRED` before any write, an
expired quote cannot create an order, a price change after issue returns
`409 QUOTE_CHANGED` with the transaction rolled back, and a committed owner/key/input
receipt still replays after its quote expires without a second order or stock change.

`npm run db:status`, `npm run db:diff`, and `npm run db:deploy` load local environment
configuration silently and prefer `DIRECT_DATABASE_URL`; for Neon, they derive the
same endpoint's non-pooled hostname when no direct override is supplied. Never print
the environment loader return value, whole errors, or credential-bearing URLs.

## Cart integrity migration

`202611160001_cart_integrity` adds revision tracking (including a database trigger
covering older writers), a 1–1000 quantity check, durable cart merge receipts, and
PostgreSQL 15+ `NULLS NOT DISTINCT` uniqueness on owner/product/SKU. It does not merge
or discard legacy cart rows; duplicates/invalid quantities cause migration failure.
`npm run db:preflight-cart` reports aggregate blocker counts without customer data.

The configured DB preflight reported PostgreSQL 18, zero duplicate groups and zero
invalid quantities. The migration was applied through a direct connection under the
user's same-DB authorization. Direct migration status was up to date and schema diff
clean afterward. Prisma's structural checker does not model triggers/checks or the
stricter nullable uniqueness; the real integration tests exercise those invariants.

Cart transactions are bounded to 30 seconds with 5-second pool acquisition. An early
five-way contention test exceeded the original 15-second transaction budget; the
30-second budget passed the initial test. The browser retains the durable import key
on timeouts, enabling confirmation/retry without duplicate addition. These bounds
are not a throughput/latency SLA; deployment function budgets and broader load testing
remain release gates.

## Browser fixture server

`npm run test:browser-fixture` creates a separate random synthetic schema, verifies
the ORM namespace, seeds a single synthetic account/product/variant, and starts the
existing production build on loopback port 3102. The test-only password is defined
in the fixture script; no customer credentials or provider APIs are involved. Use
`npm run test:browser-stop` afterward: it stops only the recorded child process and
the parent removes that exact generated schema. A seven-minute automatic expiry is
also provided. Do not rebuild `.next` while this fixture server is running; the
ignored process marker lives there. This is a manual browser acceptance environment,
not an automated browser regression suite or production deployment.

Observed browser run: guest variant add, real login, durable import, delivery and
cash-on-delivery confirmation, order placement and private order details. Synthetic
DB counts were 1 order, 1 item, 1 merge receipt, 0 cart rows and stock 9 from 10.
The first run discovered a prefetched guest redirect surviving login; fresh-document
post-auth navigation fixed it, with a second sign-in→checkout/import run confirming
the correction and no console errors. Both fixture schemas/processes were removed.
No customer orders, chargeable generation/uploads or real payment operations occurred.

## Security incident follow-up

One ad-hoc diagnostic inadvertently entered Node's REPL and printed environment
values into the session output. No values are included in repository documents.
Treat the affected database/JWT/Cloudinary/Hugging Face credentials as exposed and
rotate them with their owning services before production use. Local environment
files remain ignored. New database tools do not print the environment loader result.
