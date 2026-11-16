# Remaining completion gates

The roadmap is **not fully completed**. These are release gates, not optional
follow-ups, and local builds cannot substitute for their evidence.

## Requires environment access or approval

- The user authorized the same configured database, but no reset, customer fixture
  seeding or broad deletion is part of the current work. Fresh-schema migration and
  stock/coupon/cart/receipt concurrency checks now run in a uniquely named isolated
  schema and remove only that schema. Full backup/sanitized-restore rehearsal remains.
- Vercel project/domain access and approved environment secrets: deployment,
  migration ordering, private-data/cache/header checks and runtime smoke tests.
- Approved business identity, support contacts, returns/shipping/payment/tax rules,
  product facts and imagery: legal/trust pages, merchant policies and feed data.
  Do not invent these to tick a checklist.
- Search Console/Merchant Center access and verified domain ownership: live
  indexing, canonical selection, rich-result/feed diagnostics and monitoring.

## Substantial local engineering still required

- Framework security upgrade implemented locally: pinned Next 16.4.6, awaited
  params/searchParams and migrated proxy; production build and read-only dev smoke
  checks passed. Production dependencies audited clean. Full React/browser/runtime
   regression, current supported Node tooling and lint warnings still
  need resolution; consult `docs/framework-upgrade.md` and the latest roadmap.
- Integer/decimal money throughout quote/tax/shipping/payment state and approved tax
  allocation policy remain. Versioned checkout clearing, durable batch guest import,
  per-owner transaction locks and DB nullable-SKU uniqueness are now implemented;
  browser acceptance, retention/operations and broader performance checks remain.
- Controlled slug/history cutover and atomic rename/redirect management; variant
  attribute integrity; real pagination/global discounted-price sorting. Current
  bounded category lists are not complete pagination or global price ordering.
- Durable abuse controls, complete audit-event trust boundaries, media provider
  privacy/retention/scanning, CSP and full session lifecycle/CSRF verification.
- Repeatable browser suites, disposable DB integration tests, provider HTTP
  simulation, dependency/framework upgrade, actual CI branch protection, release
  monitoring/on-call/restore drills, and production-mode accessibility/CWV/crawls.
  A limited isolated-schema manual browser purchase flow now passed and exposed/fixed
  a stale post-auth redirect. The 17-check real PostgreSQL harness is available and
  passed; neither replaces full browser automation, restore rehearsal or load testing.

## Evidence obtained locally

- Offline tests and TypeScript/structural SQL checks are recorded in the master
  roadmap. A production build succeeded after dev/build output separation.
- Read-only GETs to the running dev server verified home/shop/category/product/
  sitemap 200s, real missing-product/category 404s and both search query aliases.
- A limited browser check verified product 3 / SKU 15 price, stock, selection and
  parent canonical. It found missing dev chunks; after `.next-dev` separation,
  re-navigation and option selection produced no console errors. This is not a
  full E2E suite, a production deployment or live search-engine validation.
