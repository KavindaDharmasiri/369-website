# 369: System Remediation and Full SEO Roadmap

Status: **in progress — checkout/security, exact checkout quotes, durable carts/order identity, and an additive recommendation/customer-engagement system implemented locally with migration applied to the configured database; browser/deployment/CI/operations, live SEO validation, and remaining release gates remain open.**

Scope: both system reviews, the isolated handler checks, performance measurement, production operations, and ecommerce SEO.

## Current implementation status

### November 16 — recommendation and customer engagement system (local)

- **Analysis and design:** inspected App Router/React/TypeScript/PostgreSQL-Prisma architecture, auth/cart/wishlist/orders/catalog/search, existing `AuditTrail`/admin notifications, and absence of personalization/recommendation storage. Designed an additive, modular system: consent-aware client event collection + trigger manager, server-side rule/next-best-action/scoring APIs, and account opt-out, using only existing infrastructure and real catalog data.
- **Additive schema/migration (applied):** `prisma/migrations/202611160002_recommendations_engagement/migration.sql` adds `user_preferences`, `engagement_events`, `recommendation_rules`, and `recommendation_logs` with indexes/FKs; no destructive changes. Direct DB `status` up to date, `diff` clean after aligning `@updatedAt` column defaults, structural migration coverage passed.
- **Server implementation:** `src/lib/recommendations/{types,rules,scoring,engine}.ts` provides configurable rule definitions/thresholds, weighted ranking, candidate generation from public/active in-stock catalog data, dedupe/cooldown/session-limit/suppression-aware suggestion selection, and best-effort impression logging. APIs: `POST /api/recommendations/events` (batched ingest, size-limited, auth-aware, opt-out respected), `POST /api/recommendations/suggest` (no-store, context-driven suggestion/next-best-action), `POST /api/recommendations/interactions` (dismiss/snooze/click/convert), `GET|PUT /api/personalization/preferences` (authenticated opt-out/consent toggle).
- **Client implementation:** `src/lib/engagement/{session,tracker}.tsx` tracks active time (visibility/focus-aware), scroll depth, page views and custom events with batching/keepalive and checkout suppression; `src/components/recommendations/ShoppingAssistant.tsx` renders one non-blocking, accessible suggestion panel with product cards/CTAs, dismiss/snooze and server interaction logging. Mounted globally via `ClientWrapper` (Suspense + `EngagementProvider`).
- **Integrations:** product page emits product view/repeat/spec/color-size/image/wishlist/cart signals and repeat-view triggers; shop search emits search-result signals; account profile exposes personalization on/off; assistant suppresses checkout/auth/cart-sensitive contexts and uses cooldown/dismiss/snooze/frequency controls. Existing auth, checkout, quote/order, and audit behavior unchanged by design.
- **Verification:** `npm test` (including `tests/recommendations.test.cjs`) **193 passed, 0 failed** in this run; `npm run typecheck` passed; `npm run lint` **0 errors, 37 warnings** (pre-existing `no-img-element`/hook-dependency warnings remain); `npm run build` completed successfully; `npm run check:migrations` passed; `npm run db:status` up to date; `npm run db:diff` clean. No Vercel deploy, no commit, no push.
- **Remaining:** browser/E2E/a11y/CWV and real-user behavior validation, production rollout/feature-flag policy approval, retention/cleanup operations, broader analytics evaluation, and all existing external release gates remain open.

### November 16 — durable carts, real PostgreSQL verification, operations

- Implemented durable atomic batch import (`POST /api/cart/merge`): mandatory owner-scoped key, canonical fingerprint, restart-safe acknowledgement replay, payload conflicts, full-batch validation and no silent capping. Checkout persists its batch identity before sending and retries that same identity after a lost response. It clears only an acknowledged unchanged local snapshot; legacy uncertain per-line receipts still require explicit review.
- Added a shared per-owner PostgreSQL transaction lock for cart add/patch/delete/merge and checkout. Cart identity is owner/product/SKU, never client specification text. `202611160001_cart_integrity` adds NULL-SKU-safe uniqueness, positive bounded quantities, durable merge receipts and a database revision trigger protecting against ABA edits by older writers. Checkout removes only matching submitted rows at the captured revision, preserving unrelated/edited rows.
- With prior same-database authorization: preflight found PostgreSQL 18, zero duplicate cart groups and zero invalid quantities. Applied `202611160001_cart_integrity` through the direct endpoint. Direct migration status is up to date and schema diff is clean. No customer cart rows were merged/deleted by the migration.
- Added opt-in `npm run test:postgres`: fresh migration chain and real concurrent cart/receipt/stock/coupon/rollback checks in a random isolated schema; exact-schema cleanup afterward. Final expanded run passed **21/21** checks, including real order-handler concurrent retry, payload conflict, cart/stock writes, owner scoping, and the quote contract (missing/expired quote, `QUOTE_CHANGED` rollback, and replay after quote expiry). Auth signature adapter and notifications are substituted. No production fixtures/provider calls. This is not backup/restore or full load/deadlock verification. See `docs/postgres-verification.md` for the discovered 15-second contention deadline, pooler/search-path diagnostics, direct-session correction and evidence boundaries.
- Added 2-second coalesced readiness and independent `/api/health/live`; notification polling now pauses/aborts hidden tabs, deduplicates, and uses capped jittered backoff. Server API errors use allowlisted redacted JSON records with incident IDs; production retains errors without raw Prisma SQL/PII logging. Fixed BOTH-market checkout inconsistency.
- Production type checking now uses `tsconfig.build.json` and a stable build declaration file, avoiding concurrent development-generated type-file deletion. Final-source production build and `npm run typecheck` **passed**. Latest offline suite **189/189**, lint **0 errors / 39 warnings**, full audit **zero vulnerabilities**, structural migration checks **passed**. Browser and real-DB evidence below do not complete the remaining roadmap.
- Browser acceptance in an isolated synthetic schema on port 3102: guest variant add, saved-bag preservation through sign-in, durable batch import/checkpoint, delivery/confirmation, one order, and private order details with payment-not-confirmed wording. DB verification showed exactly **1 order / 1 order item / 1 merge receipt / 0 cart rows / stock 10→9**. No customer rows, chargeable provider operations or real payments. Fixture process/schema and browser test auth were cleaned up.
- This browser run exposed a prefetched unauthenticated redirect surviving sign-in. Removed login/signup timers, validated local post-auth destinations, and switched auth success to a fresh document navigation. A second isolated browser run confirmed direct sign-in→checkout without the stale redirect and successful durable import, with no console errors; its fixture process/schema was also cleaned up. New batch identities fail closed on browsers without Web Locks to avoid competing cross-tab keys; an existing matching identity remains safely retryable.
- Implemented exact checkout quotes (`docs/checkout-quote-contract.md`): integer minor-unit money arithmetic, purpose-separated signed quote tokens, `POST /api/orders/quote`, quote verification before any new-order write, `QUOTE_CHANGED` rollback, replay of a committed owner/key/input receipt even after quote expiry, and a cart confirmation dialog that displays server totals and explicitly reviews price changes. Dedicated money/quote, route and UI-helper tests pass; real-PostgreSQL quote checks pass. Browser re-acceptance of the new quote/review dialog remains pending.
- Read-only final-build public smoke: home/shop/category/product+SKU/sitemap and readiness/liveness **200**; unknown product/category **404**. Product 3/SKU 15 browser rendering/reselection showed LKR 3,500.00, stock 10 and no console errors. Local canonical host still defaults to localhost without an approved `SITE_URL`; no live search-engine or deployment evidence is implied.
- Security follow-up: a diagnostic accidentally printed local environment values into session output. Credentials are not reproduced in repository files. Database/JWT/Cloudinary/Hugging Face credential rotation is required before production use; new scripts suppress environment-loader return values. No commit, push or deployment occurred.

### Latest component/runtime verification (supersedes counts below)

- Refactored legacy fetch/load helpers to declarations, added a hydration-aware browser identity subscription with same-tab/cross-tab notifications, derived account navigation from the current URL, and keyed sensitive customer/admin/cart sessions to the active identity. Browser claims remain display-only; server authorization is unchanged. Malformed/expired identity snapshots do not render an authenticated identity.
- Homepage now consumes its server-resolved catalog directly, including valid empty results, instead of refetching empty lists and showing an unnecessary loading state. Category/shop consume their server-resolved windows without false loading/refetch loops; shop search and category interactions now derive/filter from resolved state with abortable reads and explicit error states. Loading/try-on/on-device-preview state transitions no longer rely on synchronous effect setState for the corrected paths.
- Private cart/wishlist GET responses now use the explicit `publicProductSelect` (no internal actor emails/tracking tags, no unapplied slug-column probes, no wider fallback retry on database errors) while preserving existing encrypted envelopes and discount enrichment.
- Latest verification: **148/148 offline tests passed**, standalone TypeScript **passed**, `npm run lint` **passed with 0 errors** (38 warnings remain, primarily `@next/next/no-img-element` and `react-hooks/exhaustive-deps`), final-source Next 16 webpack production build **passed**, full dependency audit **zero vulnerabilities**, `npm run check:migrations` **passed** (structural only, no database contacted), `prisma generate` **succeeded**. No deployment, commit or push occurred in this pass.
- **Database (same configured DB, explicit user authorization this conversation; no disposable-clone rehearsal):** `prisma migrate deploy` applied `202611130003_slugs`, `202611130004_slug_redirects`, `202611130005_session_version` successfully; `prisma migrate status` is up to date and schema diff reports no difference. `node tools/backfill-slugs.mjs` completed and updated **9 records** (idempotent for existing slugs). Numeric/name canonicals remain intentional until controlled slug/redirect cutover; applying schema/backfill is preparation, not proof of safe SEO rollout.
- Read-only production-server smoke on `127.0.0.1:3100` (after a clean build/start in this environment): `/`, `/customer/shop?search=shirt`, `/customer/category?type=women`, `/sitemap.xml`, `/api/products/3`, `/robots.txt` returned **200**. `/customer/product?id=3&sku=15` rendered the app error boundary (500) while the started server logged `PrismaClientInitializationError` / database unreachable; this run did not establish product-page behavior and is not evidence of a regression from these edits. Earlier read-only Next 16 dev smoke checks on port 3100 had returned 200 for home/search/category/SKU product/sitemap/product API when the database was reachable.
- The full roadmap is **not complete**. Remaining work includes lint-warning cleanup/perf follow-up, broader browser/interaction/accessibility verification, financial/cart/DB constraints and real-PostgreSQL concurrency/rollback/restore rehearsal, controlled slug/redirect cutover and live SEO validation, durable import/merge completion, React 19 migration, supported Node toolchain, deployment/CI hosting evidence, provider/business/legal/content approval, and live search/merchant/operations validation.

### Framework security upgrade — prior verification (superseded by latest component/runtime verification above)

- R11: Next.js **16.4.6** pinned in package/lock files; route-handler params and public page searchParams migrated to promises. `src/proxy.ts` replaces legacy middleware with shared token/current-account authorization and segment-boundary public-path matching. Webpack explicit; loopback-only dev binding and separate output directories retained. React 18 supported but deprecated by Next 16.
- Prior checks at that point: build/test/migration-structure passed, audit zero, read-only dev smoke 200s on key routes. Latest verification above is authoritative (lint now 0 errors, 148 tests, migrations 003-005 applied and slug backfill completed on configured DB with explicit authorization, prisma generate succeeded). Node 22.12 still reports lint tooling engine warnings; React 19 and full runtime/browser/deployment validation remain pending.

### Public catalog / SEO / runtime follow-up

- Latest local verification: **136/136 tests passed**, standalone TypeScript **passed**, structural migration coverage **passed**. Production build passed after separating development `.next-dev` from production `.next`; final product-API DTO follow-up is covered by tests/types but was made after that build. CI workflow authored in `.github/workflows/verification.yml`; hosted execution/branch protection remains unverified.
- Read-only HTTP smoke checks on the running dev server: `/`, `/customer/shop`, `/customer/category?type=women`, `/customer/product?id=3`, `/sitemap.xml` returned **200**; missing numeric product, missing collection and missing product ID returned **404**. Both `search` and `q` query aliases are noindex in metadata tests; actual `search` response was observed noindex.
- Limited browser verification: product 3 / SKU 15 renders LKR 3,500.00, stock 10, selected option and parent canonical. Re-selecting the option completes with no console errors. Browser initially found missing JS chunks; moving dev output to `.next-dev` fixed them, and the page remained error-free after a production build. This is not a full browser regression suite or production smoke test.
- S01/S05/S09/S14/S15/S17: shared explicit-selection catalog access avoids missing-slug probes on normal numeric/name public flows, removes internal actor emails from public product responses, excludes hidden products, preserves sold-out published pages, and propagates outages rather than false 404s. Category notFound/redirect signals are no longer swallowed. SKU deep links, active variant ProductGroup/offers, current discounted SKU prices, truthful availability and safe JSON-LD serialization implemented locally with tests. Rich Results/Search Console and full price/stock agreement against a real quote/feed remain pending.
- S07/S10/S11: actual search query aliases noindex; numeric/name canonicals intentionally retained until a controlled slug cutover; sitemap matches those canonicals, includes temporarily sold-out products, omits invented static timestamps and selects only explicit available columns. Split sitemap/pagination and URL migration still pending.
- V05: read-only CI jobs for locked install, Prisma generation, offline tests, structural migration checks, build/types, and a separate non-suppressed dependency-audit gate. No deployment, migration, seed, provider or production credentials are configured by this workflow.
- Current `npm audit --audit-level=high` **fails**: one critical Next.js and one high PostCSS finding. Registry recommends a breaking Next 16.4.6 upgrade. This is an unresolved release blocker, not waived by a passing build. Remaining engineering and external requirements are listed in `docs/roadmap-completion-gates.md`; the roadmap is **not fully complete**.

### Latest investigation corrections

Latest follow-up batch: `npm test` **117/117 passed** and standalone TypeScript checks **passed**. Extended the revoked/inactive/unverifiable-session test matrix across order, cart, wishlist, addresses, coupon preview, notifications, ads administration, category/subcategory detail administration, audit GET, settings/shipping mutations, and review creation. Tests use offline substitutes, not PostgreSQL or browsers.

- R14: current-account checks now cover order creation/list/detail/status/PDF/request resolution, cart reads/writes/items, wishlist, addresses, coupons, notifications, ads, category/subcategory admin helpers, settings/shipping mutation, reviews POST, and audit handlers. Current DB roles override stale JWT admin claims. Full lifecycle/CSRF/deployment verification remains pending.
- Privacy: ads GET previously treated any Authorization header as permission to read inactive banners. Private listing now requires a current active admin and uses no-store; public listing remains active-only.
- Validation: wishlist IDs reject partial numeric parsing, hidden products and cross-product/inactive SKUs are rejected before writes. Malformed notification ID lists no longer fall through to mark-all; selected notification updates are recipient-scoped. Sidebar does not mark reads successful on failed HTTP responses.
- Shipping: validate fee type and finite/nonnegative value before writes; replace the active fee inside one transaction so a failed create rolls back deactivation. A real PostgreSQL single-active/concurrent-update constraint and business limits still need verification.

Verification for this correction batch: `npm test` **108/108 passed**, `npx tsc --noEmit --incremental false` **passed**, `npm run check:migrations` **passed** (structural only). No new Next production build, browser/E2E, real-DB concurrency checks, migrations, or deployment were run in this batch. Type checking avoids rewriting `.next` build output while a developer may be running `next dev`.

- R10: unsafe automatic batch guest-cart import disabled; signin/signup preserve saved items and uncertain-transfer receipts. Durable import remains **pending**, not completed. Contract: `docs/cart-import-contract.md`.
- R14: profile GET/PUT now use fail-closed shared authentication, not a test-fixture bypass. Versionless JWTs count as session version zero and cannot bypass later revocation bumps. Admin combined activation/revocation returns 409 without fallback activation or false success audit when the session-version migration is missing. Revocation coverage across manual-auth routes remains **pending**.
- Product interactions: restored ordered active-SKU matching, immediate stale-selection clearing, abort/late-response protection, malformed-image fallback, checked cart responses, and locked guest-cart writes in `ProductClient.tsx`. Browser interaction verification remains **pending**.
- Cart display: current product/SKU prices are no longer overwritten by saved guest prices. Live-price fetch failures and unavailable variant handling still need broader review.
- New offline regression tests: auth DB failures, inactive/revoked/versionless tokens, current DB roles, disabled batch imports, preservation of saved bags, combined admin security changes, and stale guest prices. Latest verification is recorded below; none of these checks establishes production readiness.

Checkbox rule: `[x]` means the stated deliverable is implemented and locally verified. `[ ]` means pending, or only partially implemented. A parent item remains open until its entire scope is verified. Local tests are not proof of PostgreSQL concurrency, deployed behavior, or SEO results.

| Deliverable | Status | Evidence / remaining work |
| --- | --- | --- |
| Shared order/cart input validation (R01) | Complete locally | Invalid JSON, delivery/payment data, IDs, item counts, and quantities covered by offline handler tests |
| Trusted products/SKUs and required variants (R02) | Implemented; integration/UI verification pending | Checkout/cart enforce saleability, matching active SKU and category; quick-add goes to options; product supports SKU-only catalogs |
| Duplicate-line consolidation and conditional stock reservation (R03) | Implemented; PostgreSQL verification pending | Offline combined-line, lost-reservation, query-condition, and simulated rollback tests pass; real concurrency/retry work remains |
| Durable order idempotency (R04) | Implemented locally; PostgreSQL/deployment verification pending | Mandatory user-scoped key, canonical fingerprint, transactional receipt, stored-response replay, conflict/abandoned resolution, browser attempt persistence, forward migration and offline route tests pass; real concurrency and rollout remain unverified |
| Schema parity and migrations (R22) | Applied with authorization; fresh-schema rehearsal verified | Configured DB applied through cart-integrity migration; direct status/diff clean. Fresh isolated PostgreSQL schema migration chain passed. Sanitized existing-data upgrade and backup/restore rehearsal remain pending |
| Zero tax / low-stock threshold (part of R05) | Complete locally | Zero values preserved in checkout, settings and notification queries; full money/tax policy work remains |
| Coupon validation and conditional final redemption (R06) | Implemented; PostgreSQL verification pending | Create/update/legacy-value validation and simulated exhausted/race tests pass |
| Discount partial-update/target fixes and SKU-price comparison (R07) | Complete locally; policy confirmation pending | Merged-state validation, target-only update, scope cleanup and actual-SKU comparisons tested |
| Profile-update hash exposure (part of R12) | Complete locally | Explicit public-field selection tested against decoded output; broader response audit remains |
| Invalid-token 401 in changed order/cart routes (part of R14) | Complete locally | Order GET/POST tests pass; complete session/role/revocation work remains |
| Settings validation-before-write and atomic upserts (part of R27) | Complete locally | Invalid requests start no operations; simulated transaction failure rolls changes back; shipping work remains |
| Dynamic minimal 200/503 health response (part of R28) | Complete locally | Dynamic/no-store/error-redaction tests pass; bounded probe and separate liveness remain |
| Durable guest-cart import (R31) | Implemented; browser/operations verification pending | Atomic owner/key/hash receipts, all-or-nothing validation, durable retries, exact local checkpointing, nullable-SKU uniqueness and PostgreSQL concurrency/rollback checks. Legacy uncertain imports are not automatically replayed |
| Checkout mutation/coupon/confirmation state (parts of R08/R18/R33) | Implemented locally; browser acceptance pending | HTTP+success-envelope checks, coupon request invalidation, text-only dialogs, order guard, persisted attempt identity and explicit resolution control added; exact server quote, changed-total review, quote rollback/replay and isolated PostgreSQL checks added; browser acceptance of the new dialog remains |
| Parallel checkout initialization (R41) | Complete locally; live timing unmeasured | Resource loader starts independent work together and waits for all settlements before retry |
| Payment display and private order details (parts of R09/R14/R37) | Complete locally; state redesign pending | Payment is not inferred from card/delivery; owner filter/SKU-code selection/no-store and token/ID checks tested |
| Offline regression suite (parts of R00-4, V01) | Available; broader suites pending | Offline handler/helper tests added; no real DB, browser, or external providers used |
| Technical/content SEO (S01–S28) | In progress (foundations only) | `siteUrl` helper, root metadata base/defaults, `robots.ts`, dynamic `sitemap.ts` (public categories/products, redirect URLs excluded), noindex layouts for admin/auth/account/cart, server `not-found`, crawlable links on landing/shop/category, root Organization/WebSite JSON-LD, and server metadata/404 plus basic BreadcrumbList+Product JSON-LD for `/customer/product` added locally; slugs/history, legacy redirects, fully server-rendered public content, dynamic collection metadata from stable slugs, complete structured data (variants/offers/ratings/policies), crawlable nav/breadcrumbs everywhere, pagination/facet policy, content/trust pages, feeds and Search Console remain pending |
| Production rollout and all release gates | Not complete | Authorized DB migrations applied; no deployment, customer order test mutations or provider calls. Isolated fixtures only; full release gates remain open |

Verification for the third batch:

- [x] `npm test`: **98 passing tests/subtests**, zero failures/skips; exit code 0. This includes route-level mandatory-key, replay, conflict, receipt rollback, owner-scoped resolution, abandoned-identity, browser-attempt and migration-structure checks.
- [x] `npx tsc --noEmit --incremental false`: passed; exit code 0.
- [x] `npm run check:migrations`: passed; exit code 0. It compares repository SQL declarations offline; it does not execute SQL or contact a database.
- [x] `npm run build` after the third batch: passed; exit code 0, including a clean rebuild after removing a stale `.next` cache. No Browserslist warning appeared in the final clean/incremental builds; the earlier warning remains tracked under R11/V05.
- [x] `npm run build` after Docker removal and SEO foundation changes: passed; exit code 0. Type checks passed. No live crawl/indexing, Vercel deployment, or database-backed sitemap verification was performed.
- [x] `npm test`, `npm run check:migrations`, and `npm run build` after continued implementation (slug/redirect/session-version schema+migration groundwork, slug-aware links/sitemap/category resolution, redirect lookups, men/women permanent redirects, baseline security headers, tryon/upload validation, basic in-memory rate limits on login/register/tryon/coupon-validate/upload, admin audit helper for key mutations, middleware DB activation+sessionVersion checks, admin/self session revocation endpoints, seed hardening, broad route hardening, and pre-migration compatibility fallbacks for missing slug columns across landing/shop/category/product pages, categories/subcategories/products/search/featured/new-arrivals/product APIs, wishlist/cart, and related server lookups, plus prior SEO/server-metadata/JSON-LD/not-found/crawlability/idempotency work): passed (98/98 tests). `next build` type checking passed. No browser/Vercel/live-DB/migration-apply/prisma-generate verification performed.
- [x] `npx prisma generate` was attempted and **failed** with `EPERM` while renaming a locked `query_engine-windows.dll.node`. Generated declarations already contain `orderRequest`, and type checking passed, but generation is not reported as successful.
- [x] Production PostgreSQL migrations applied with explicit user confirmation (not disposable/clone-rehearsed): `prisma migrate status` showed 0_init/parity/receipt pending on the configured DB; `prisma migrate diff --from-url ... --to-schema-datamodel ...` showed only `order_requests` missing, so `0_init` and `202611130001_schema_parity` were marked applied via `prisma migrate resolve --applied` and `prisma migrate deploy` successfully applied `202611130002_order_requests`. Final status/diff were clean at that point. `202611130003_slugs` has since been added locally and is **not applied**. No destructive reset was performed.
- [ ] Real PostgreSQL concurrency/rollback/restore verification, browser acceptance tests, and full migration rehearsal on disposable/isolated copies: not performed. Applying to production before clone rehearsal is a risk accepted by explicit confirmation.
- [ ] Production deployment, dependency upgrades, and SEO rollout: not performed.

Tests, the behavior contract and the rollout runbook are in `tests/`, `docs/checkout-safety-contract.md` and `docs/database-migration-runbook.md`. The test database is an in-memory substitute, not PostgreSQL. The production build verifies compilation/bundling, not live API behavior or browser performance. Do not deploy receipt-dependent code before the reviewed migrations and client generation are verified: order creation now requires `Idempotency-Key`, and guest-cart batch idempotency, authentication/dependency work and other release gates remain open.

## 1. Objectives and constraints

1. Prevent incorrect orders, overselling, negative prices, and avoidable data loss.
2. Make deployments and database upgrades reproducible and recoverable.
3. Secure sessions, uploads, administrative operations, and personal photos.
4. Measure and improve real customer performance, especially on mobile.
5. Make public products and collections discoverable, indexable, useful, and eligible for relevant search features.
6. Add regression checks so fixes remain fixed.

Evidence boundaries:

- TypeScript and the production build passed during the reviews. They do not prove business correctness.
- Twelve isolated scenarios exercised real handlers/helpers using database/auth substitutes. These were not real PostgreSQL integration or concurrency tests.
- The dependency audit reported nine affected packages: one critical and eight high. Assess advisory reachability as well as upgrading.
- No production browser timings, infrastructure configuration, database query plans, or Search Console data were verified.
- The SEO inspection found a shared root title/description, client-loaded catalog content, JavaScript-only product-card navigation, and no dedicated sitemap/robots metadata routes. Search-engine indexing itself was not inspected.

### Priorities

| Level | Meaning | Release policy |
| --- | --- | --- |
| P0 | Order integrity, sensitive-data exposure, serious dependency/deployment risk | Contain immediately; block production expansion until verified |
| P1 | Security, reliability, correctness, major performance and technical SEO | Required before broad launch or a major SEO migration |
| P2 | UX, content depth, operational efficiency, organic growth | Deliver after safety gates; continue iteratively |

### Ownership and planning assumptions

Role labels below are responsibilities, not instructions to create agents or hire a team:

- Backend: API, transactions, authentication, schema, integration tests.
- Frontend: customer/admin interfaces, rendering, accessibility, browser tests.
- Operations: deployment, secrets, backups, monitoring, CI.
- SEO/content: search intent, copy, product information, indexing, merchant feeds.
- Business owner: tax rules, payment semantics, cancellation policy, target markets, shipping/returns, privacy approval.

Indicative effort: **43–67 engineering working days**, plus ongoing content/SEO work. This is an estimate, not a deadline. With one engineer, allow approximately **9–14 working weeks** before contingency and external approvals. Re-estimate after Phase 0; do not compress concurrency or migration testing to meet a date.

## 2. Delivery sequence

| Phase | Priority | Effort estimate | Main dependency | Exit gate |
| --- | --- | --- | --- | --- |
| 0. Contain and establish evidence | P0 | 2–3 days | None | Backups, baseline, approved behavior, regression backlog |
| 1. Checkout and pricing integrity | P0 | 5–8 days | Disposable test DB from Phase 0 | Real-DB order/concurrency tests pass |
| 2. Security and authentication | P0/P1 | 5–8 days | API/session decisions; coordinate dependency upgrade early | Auth, privacy, upload, and abuse controls pass |
| 3. Database, deployment, data safety | P0/P1 | 5–7 days | Backup rehearsal; reviewed migration strategy | Fresh install and existing-data upgrade pass |
| 4. Catalog, customer/admin correctness | P1 | 4–6 days | Stable contracts from Phases 1–3 | End-to-end purchase/admin workflows pass |
| 5. Performance and resilience | P1 | 5–8 days | Measured baseline, reliable data model | Agreed latency/load budgets pass |
| 6. Technical and ecommerce SEO | P1 | 8–12 days | Public visibility rules, pricing, slugs, rendering/cache design | Crawl, metadata, redirects, structured data pass |
| 7. Content, trust, merchant discovery | P1/P2 | 4–7 days initial | Business facts and Phase 6 templates | Approved content and eligible feeds published |
| 8. Release and continuous verification | P1 | 5–8 days | All applicable gates | Canary, monitoring, rollback rehearsal pass |

Security containment, dependency remediation, test infrastructure, and content research can overlap. Phase order is not permission to postpone urgent exposure reduction. Build tests alongside each fix, not only in Phase 8.

**Critical path:** containment → trusted checkout/data → public rendering and URLs → SEO migration → verified release.

## 3. Phase 0 — Contain, baseline, and agree behavior

Owners: backend, operations, business owner.

- [ ] R00-1: If the affected system is live, disable unsafe quick-add/checkout paths or gate ordering until server-side protections land. Rate-limit or temporarily disable costly try-on if abuse controls are absent.
- [ ] R00-2: Back up production data and rehearse restoration into an isolated environment. Do not seed or run destructive tests against production.
- [ ] R00-3: Create a disposable PostgreSQL database, representative sanitized fixtures, and staging with access controls and `noindex` headers. Never copy real customer photos into fixtures.
- [ ] R00-4: Convert the isolated findings into committed regression tests, then extend them with real PostgreSQL and browser coverage.
  - [x] Add an offline regression suite and an `npm test` command without new test dependencies.
  - [ ] Add/run isolated real PostgreSQL concurrency and browser suites; do not mark the phase complete from handler doubles alone.
- [ ] R00-5: Establish intended API contracts: positive integer quantities, required SKU behavior, safe response fields, status/error codes, idempotency, list pagination, and authentication. Keep runnable requests/assertions or an OpenAPI contract in Git; never include secrets.
  - [x] Record first-batch checkout, promotions, settings, and profile behavior in `docs/checkout-safety-contract.md`.
  - [x] Record the mandatory order key, canonical fingerprint, replay/conflict, receipt-rollback and abandoned-identity behavior in the same contract.
  - [ ] Complete session and pagination contracts with their implementations.
- [ ] R00-6: Confirm tax treatment, coupon stacking, rounding, inventory ownership, payment-at-delivery wording, cancellation/refund/restocking policy, and the meaning of reported revenue. Do not invent business or legal rules.
- [ ] R00-7: Record production-mode mobile baselines for home, collection, search, product, cart, checkout, admin, and try-on: network waterfall, long tasks, JS transfer, image bytes, API p50/p95/p99, DB query counts, and error rates.
- [ ] R00-8: Confirm canonical production domain, target countries/languages, brand/legal identity, support contacts, shipping/return policies, analytics consent, and access to Search Console/Merchant Center. LKR is present in the application; confirm market assumptions rather than assuming location.

Exit: restore works; staging cannot create real orders or external charges; the issue backlog and baseline are recorded.

## 4. Phase 1 — Checkout, inventory, pricing, coupons

Owners: backend, frontend, business owner.

Primary files: `src/app/api/orders/route.ts`, `src/app/api/cart/route.ts`, `src/app/api/cart/[id]/route.ts`, `src/lib/pricing.ts`, `src/lib/coupons.ts`, `src/lib/discounts.ts`, discount/coupon routes, `prisma/schema.prisma`.

- [x] R01: Add shared runtime request schemas. Reject invalid JSON shapes, non-array/oversized item lists, missing/invalid IDs, non-integer/zero/negative/oversized quantities, non-finite numbers, invalid payment methods, and incomplete delivery fields. Return actionable 400/422 errors. Implemented for checkout and cart; local validation tests pass.
- [ ] R02: Resolve products/SKUs server-side. Enforce published, active, nondeleted, saleable products, category visibility, stock rules, SKU ownership, and required variants. Quick-add must open variant selection when necessary. Derive names/specifications/prices from trusted records.
  - [x] Implement trusted server resolution and required variants in order/cart handlers; derive order snapshots from database records.
  - [x] Remove SKU-less quick-add; expose a variant chooser for products without specification definitions; stop reporting failed product cart writes as success.
  - [ ] Verify real-database and browser guest/authenticated purchase flows before closing R02.
- [ ] R03: Consolidate repeated SKU lines before validation. Reserve/deduct stock with a condition such as `stock >= requested` and verify the affected-row count. Use suitable transaction isolation/locking and bounded deadlock/serialization retries; the transaction wrapper alone is not sufficient.
  - [x] Combine repeated product/SKU lines, use deterministic SKU ordering, condition stock deductions on available active stock, and return 409 on a lost reservation.
  - [ ] Run real PostgreSQL simultaneous buyers/rollback tests and add bounded transaction-conflict handling where needed.
- [ ] R04: Add durable order idempotency scoped to the authenticated customer. Persist the key, payload fingerprint, and result under a database uniqueness constraint. A retry returns the same order; the same key with a different payload returns a conflict. Handle concurrent first requests safely.
  - [x] Require a bounded `Idempotency-Key`; canonicalize and hash trusted order input; claim a `(userId, key)` receipt inside the order transaction before inventory/coupon work.
  - [x] Replay the stored initial response without revalidation or notifications; return `IDEMPOTENCY_CONFLICT`, `ORDER_REQUEST_UNCONFIRMED`, or `ORDER_REQUEST_ABANDONED` without creating another order.
  - [x] Add an authenticated, owner-scoped resolution endpoint that returns a completed order or commits a permanent abandoned tombstone; never cancel an existing order.
  - [x] Persist only the scoped key/fingerprint in the browser, reuse unchanged attempts, block automatic replacement after an uncertain changed request, and expose explicit resolution.
  - [x] Add offline route/helper tests, a forward receipt migration and rollout runbook.
  - [x] Verify real PostgreSQL unique-index waiting, durable replay and transaction rollback in isolated fixtures; Prisma generation succeeded.
  - [ ] Complete deadlock/timeout matrix, receipt retention/operations and caller rollout; deployment remains excluded by user instruction.
- [ ] R05: Use decimal arithmetic or integer minor units consistently for prices, percentage/fixed tax, shipping, line totals, and discounts. Define rounding points. Preserve valid zero tax/threshold values; never use truthy defaults for numeric configuration. Respect the approved `chargeTax` policy.
  - [x] Preserve zero tax and low-stock thresholds; reject non-finite/out-of-range checkout amounts.
  - [ ] Complete decimal accounting and confirm taxable-item/coupon rounding policy with the business owner.
- [ ] R06: Validate coupon types, positive values, percentage upper bounds, minimums, caps, usage limits, and date order on both create and update. Reject negative discounts; defensively bound calculated discounts to valid totals. Reserve limited coupon usage atomically with order creation.
  - [x] Validate create/merged-update coupon values/windows/limits; reject unsafe legacy records and preserve zero caps/usage limits.
  - [x] Use a conditional coupon-use update inside the order transaction and handle a lost redemption as 409.
  - [ ] Verify the final-use race and rollback on real PostgreSQL.
- [ ] R07: Validate the merged existing/new discount state on PATCH, preventing the 150% partial-update bypass. Allow target-only updates; validate scope/target consistency and clear obsolete scope foreign keys. Recheck the intended discount priority and choose the best discount using the actual SKU price when applicable.
  - [x] Add shared create/merged-update promotion validation, real target checks, target-only PATCH and obsolete-target cleanup.
  - [x] Defensively ignore invalid legacy discounts and compare scoped candidates using the actual SKU price in order/cart/wishlist/SKU pricing.
  - [ ] Confirm the retained product > subcategory > category priority with the business owner and verify admin UI behavior.
- [ ] R08: Create a server-side quote calculation shared with checkout/order placement. Revalidate coupon eligibility after cart changes. If the final trusted amount changes, present the new amount for customer confirmation rather than silently charging/showing a different total.
  - [x] Clear stale coupon previews when account-cart edits begin; invalidate late preview responses and require reapplication before using the discount again.
  - [x] Add the authoritative quote/changed-total confirmation flow: shared trusted calculation, purpose-separated signed quote, quote required for new orders, `QUOTE_CHANGED` review on price/policy movement, and a dialog that displays server totals and flags differences. Browser re-acceptance remains pending.
- [ ] R09: Implement explicit order and payment state transitions. Keep payment status distinct from fulfilment; card-on-delivery is not automatically paid. Cancellation/refund/restocking/coupon-release actions must be policy-driven, transactional, and idempotent.
  - [x] Stop displaying card-on-delivery or fulfilment-only states as paid; use conservative labels tested against explicit statuses.
  - [ ] Separate payment/fulfilment persistence and implement approved transition/reconciliation rules.
- [ ] R10: Prevent concurrent cart additions from losing quantities or creating duplicates. Normalize variant/spec identity; implement an appropriate uniqueness rule, including nullable SKU cases, and atomic updates. Clear only checked-out cart lines/version so newly added items are not accidentally deleted.
  - [x] Replace unsafe signin/signup imports with a durable checkout batch: atomic receipts, normalized SKU identity, per-owner cart locking, database NULL-safe uniqueness and revision tracking, and submitted-line/revision checkout clearing. Real PostgreSQL tests verify concurrent imports, ABA edits, unrelated-row preservation and rollback. Browser/session acceptance and higher-contention/performance coverage remain pending.

Acceptance checks:

- Negative/zero/fractional/huge quantities produce no database changes.
- Two lines of four against five available units are rejected without partial writes.
- With stock five and 20 simultaneous one-unit attempts, exactly five succeed and stock never becomes negative.
- Concurrent last-use coupon attempts cannot exceed the limit.
- Sequential/concurrent retries with one idempotency key create exactly one order and one inventory deduction.
- Zero tax stays zero; all money math matches approved cent-level examples.
- Percentage discount over 100%, negative coupons, invalid targets, and invalid date windows are rejected.
- A failed transaction leaves stock, coupon usage, order items, and cart unchanged.

## 5. Phase 2 — Security, authentication, privacy

Owners: backend, frontend, operations.

Primary files: `src/lib/auth.ts`, `src/lib/apiMiddleware.ts`, `src/lib/clientAuth.ts`, `src/middleware.ts`, login/register/profile/upload/try-on/audit routes, `next.config.js`, dependency files, `prisma/seed.ts`.

- [ ] R11: Upgrade to a maintained Next.js/runtime/dependency combination that resolves applicable advisories. Inspect transitive dependency chains, remove unused heavy packages where safe, and use one package manager/lockfile consistently. Test framework route parameters, middleware, caching, images, and build changes explicitly; do not blindly run a force upgrade.
  - [x] Ran `npm audit fix` (non-breaking) and verified tests/build pass locally. Remaining critical/high advisories (Next/postcss) require a breaking Next upgrade and full regression testing.
- [ ] R12: Use explicit safe response DTOs/selections everywhere. Remove `password` from profile-update output and assert that hashes/tokens/internal fields cannot leak through user endpoints or errors.
  - [x] Use one explicit public-profile selection in GET/PUT and test that PUT never returns the password field.
  - [ ] Complete the response/error-field audit across all other endpoints.
- [ ] R13: Replace duplicated JWT handling with a tested session/auth design. Prefer server-set HttpOnly, Secure production cookies with an appropriate SameSite policy. When moving to cookie-authenticated mutation APIs, add CSRF/Origin protection and credentials-aware client behavior. Test PDF navigation and middleware/API consistency.
- [ ] R14: Enforce current user activation and role on protected APIs, with session version/revocation support. Define expiry, renewal, logout, admin role-change, and inactive-account behavior. Reject invalid/expired tokens as 401 rather than null dereferences/500s. Client token decoding is not authorization.
  - [x] Reject invalid tokens early in changed order/cart endpoints; test order GET/POST rejection without DB access.
  - [x] Added invalid-token/positive-userId guards and `private, no-store` headers to wishlist, cart, cart item (PATCH/DELETE), addresses, profile, orders detail/PDF, notifications, audit GET, shipping POST, settings PUT, ads/admin stats/users/coupons/discounts, coupon validate, login/register, reviews POST, categories/subcategories admin routes, product admin image/spec/sku management routes, upload/tryon, and auth middleware failures locally; profile PUT now validates basic body fields. `requireAuth`/`requireAdmin` now load and require an active DB user (activation/role enforcement for middleware-protected APIs) and include forward-compatible `sessionVersion` checks when token/DB fields are present. Added `users.session_version` schema + `202611130005_session_version` migration groundwork (**not applied**), sessionVersion in login/register tokens, and admin user PATCH (`/api/admin/users/[id]`) to update activation and revoke sessions via sessionVersion increment (compatible fallback when migration not applied). Added basic tryon/upload file validation and in-memory rate limits on login/register/tryon/coupon-validate/upload (partial, process-local). Many routes still need consistent validation, broader revocation/version-bump flows, expiry/renewal/logout behavior, and durable/distributed abuse controls.
- [ ] R15: Rate-limit login, registration, audit ingestion, coupon attempts, and expensive generation using a shared store suitable for multiple instances. Add bounded request bodies, resource/concurrency budgets, generic credential errors, password policy, email normalization, and verification/recovery flows as required for production. Consider MFA for administrators.
- [ ] R16: Remove predictable administrator creation from production seeding. Supply bootstrap credentials through approved secret handling; rotate known defaults if deployed. Separate demo data and production account setup.
  - [x] Updated `prisma/seed.ts` to remove hardcoded admin/demo credentials and console output of defaults; admin bootstrap now requires `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, demo seeding is explicit/guarded in production via `SEED_DEMO_DATA`, and `.env.example` documents seed controls. Rotation of any previously deployed known credentials and verified production bootstrap procedure remain pending.
- [ ] R17: Remove shared browser AES as a claimed security boundary. Migrate encrypted payloads to versioned ordinary JSON over HTTPS without breaking existing callers. Remove the public encryption-key requirement only after migration; keep real secrets server-only and out of logs/build artifacts.
- [ ] R18: Replace user-controlled HTML interpolation in SweetAlert with text or safely escaped DOM rendering. Safely serialize future JSON-LD, including escaping `<`. Introduce CSP in report-only mode first, then enforce it after testing Next.js, Cloudinary, inference workers, and third-party assets. Add appropriate transport/frame/referrer/content-type headers.
  - [x] Replace checkout confirmation/success HTML strings with text-only dialogs; add regression checks for literal hostile input and absence of the HTML sink.
  - [x] JSON-LD in layout/product pages escapes `<` as `\u003c`. Added baseline security headers in `next.config.js` (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, minimal `Permissions-Policy`, no powered-by). Current source scan found no SweetAlert `html:` usage; CSP report-only/enforcement and broader rich-content review remain pending.
  - [ ] Add/test CSP, transport/browser headers and safe future JSON-LD serialization.
- [ ] R19: Validate upload presence, byte size, actual format, decoded dimensions/pixel count, and allowed media types before costly processing. Bound response downloads, concurrent uploads, and processing time. Validate/allowlist provider/result URLs and handle redirects safely; do not treat a regex for `https` as complete URL safety.
- [ ] R20: Define try-on consent, provider disclosure, retention, deletion, and access control for personal photos. Avoid indefinitely public raw-person uploads; use restricted delivery where possible and scheduled cleanup. Exclude photos, tokens, addresses, and sensitive query values from telemetry.
- [ ] R21: Produce trusted server-side audit records for administrative/business mutations. Treat page/time events as untrusted analytics with allowed event types, size/rate limits, retention, and privacy controls. Do not silently report successful security logging when persistence fails.
  - [x] Added `src/lib/audit.ts` and best-effort audit writes for key admin mutations (coupons, discounts, settings updates). Persistence failures are logged but do not currently fail mutations; broader coverage, trusted/fail-closed behavior where required, event typing/limits/retention/privacy and analytics separation remain pending.

Acceptance: auth/CSRF/role/revocation tests pass; no sensitive fields in responses or logs; oversized/nonimage uploads are rejected; rate limits work across instances; known defaults are gone; dependency exceptions are explicitly justified with owners and expiry dates.

## 6. Phase 3 — Database and deployment safety

Owners: backend, operations.

- [ ] R22: Inventory actual deployed schema versus committed migrations. Add reviewed forward migrations for missing tables/columns/indexes. The missing-table inventory includes try-on spaces/payments/free pools, app settings, notifications, ads, wishlist, reviews, coupons, and discounts. Never rewrite an already-applied migration to hide drift. If production was created with `db push`, prepare and rehearse a verified baseline/resolve strategy.
  - [x] Preserve `0_init`; add forward schema-parity and order-request migrations with explicit transactions.
  - [x] Add an offline structural checker, read-only orphan preflight SQL and a clone/baseline/rollout/rollback runbook.
  - [x] Run the complete migration chain against a new isolated PostgreSQL schema on the authorized database and verify cart constraints/rollback with synthetic fixtures.
  - [ ] Complete an isolated sanitized existing-data upgrade and full backup/restore rehearsal; fresh-schema tests are not a restore test.
- [ ] R23: Add database defenses where practical: nonnegative stock/money, positive quantities, bounded ratings, valid state values, foreign-key consistency, and suitable uniqueness rules. Account for PostgreSQL null semantics in wishlist/cart uniqueness. Clean/deduplicate existing data before constraints; do not delete customer records blindly.
- [ ] R24: Remove the unused container deployment path and make Vercel deployment explicit: supported Node runtime, generated Prisma client/try-on assets, PostgreSQL-only configuration, no committed secrets, and documented build/migration ordering. Fail fast on invalid required configuration.
  - [x] Delete the unused container deployment files and `output: 'standalone'`; update the README and deployment runbook for Vercel.
  - [ ] Verify a real Vercel build/startup, environment configuration, function duration, and release ordering; no deployment was performed in this session.
- [ ] R25: Make model/WASM setup deterministic: pinned model versions, content checks/checksums where available, atomic file writes, explicit failures for required assets, and a smoke test that loads worker/models from the final container. Distinguish currently unused on-device assets from actively required features.
- [ ] R26: Make product/specification/SKU operations atomic and history-safe. Prefer soft deletion/deactivation for records referenced by orders. Replace destructive SKU regeneration with stable variant identities, a preview/diff, bounded combination counts, and preserve inventory/history. Specification replacement must not delete existing attributes before the replacement is validated.
- [ ] R27: Validate the full settings/shipping request before writing. Use one transaction for related changes, a deterministic single-active-shipping rule, and upserts where appropriate. Protect product/base-SKU/common-index creation from partial writes and concurrent code collisions.
  - [x] Validate all settings before creating write operations; use transactional upserts; test zero values, invalid requests and simulated rollback.
  - [ ] Complete shipping invariants and product/common-index creation safety; verify real-DB failure behavior.
- [ ] R28: Make readiness checks dynamic and return 503 when required dependencies fail. Separate liveness from readiness; bound DB probe time. Public health output must not include raw database errors or detailed secret-configuration diagnostics.
  - [x] Make `/api/health` dynamic/no-store, return minimal 200/503 responses and remove detailed configuration/database errors.
  - [x] Add a 2-second coalesced readiness deadline and separate dependency-free liveness, with timeout/recovery tests.
  - [ ] Deployment-level verification remains excluded/pending.
- [ ] R29: Retain production error reporting instead of stripping all console errors. Add structured redacted logs, request IDs, error tracking, migration/deploy alerts, and documented secret rotation. Review DB pooling/connection budgets for the actual hosting model.
- [ ] R30: Correct README/setup instructions to PostgreSQL and the approved migration/environment/package-manager workflow. Record backup, deploy, rollback, dependency upgrade, and incident runbooks.
  - [x] Add `docs/database-migration-runbook.md` covering starting-state discovery, clone/baseline paths, required PostgreSQL acceptance cases, rollout, rollback and receipt retention.
  - [ ] Correct the README's remaining MySQL/`db push` wording and record backup/dependency/incident runbooks.

Acceptance: a fresh database and an upgrade from sanitized existing data both work; container installation/startup/assets pass; no referenced-order history is destroyed; shipping/settings failure injection leaves a consistent state; backup restore and application rollback are demonstrated.

## 7. Phase 4 — Customer and admin correctness

Owners: frontend, backend.

- [ ] R31: Merge guest/server carts instead of discarding guest items. Use an idempotent batch merge with per-item outcomes; retain failed items locally and clear only acknowledged items. Reconcile counts after login/logout and expiry.
  - [x] Merge saved lines even into a nonempty account bag, checkpoint matching acknowledgements, retain rejected/unprocessed data, and show review/remove/retry controls.
  - [x] Persist an in-flight receipt before each transfer; pause automatic replay after uncertain responses/checkpoint failures; serialize app guest writers and detect changed snapshots. Offline storage/reload/concurrent-change tests pass.
  - [x] Replace new sequential imports with durable owner-scoped atomic batch merging and persisted browser keys; verify lost-response/checkpoint/session/snapshot safeguards offline and concurrent/restart/rollback semantics on PostgreSQL.
  - [ ] Cross-tab/browser acceptance, receipt retention operations and legacy uncertain-copy review remain open.
- [ ] R32: Represent selections by stable spec/attribute IDs in deterministic spec order, not object insertion order. Reset stale SKU/options/images when changing products or finding no match. Cancel/ignore stale requests and remove unmanaged timers. Disable purchase while variant resolution is pending.
  - [x] Order variant keys by specification order, clear unmatched SKUs, replace per-selection requests with a tested local lookup of the loaded SKU list, remove artificial selection timers, and disable purchase during option loading.
  - [ ] Migrate matching to stable IDs and verify rapid cross-product navigation/browser behavior.
- [ ] R33: Check HTTP status on every mutation before showing success or changing local state. Add useful error/retry/empty/loading/not-found states, including direct product links. Surface actionable stock/coupon/order errors without exposing internals. Remove arbitrary login and variant delays.
  - [x] Check both HTTP status and expected success envelopes for checkout/drawer cart edits; serialize local edits, expose reload errors, and clear stale coupons. Preserve failed local mutations and prevent older drawer reads from overwriting edits.
  - [x] Guard order confirmation/submission before the dialog, use text-only output, and direct unknown outcomes to My Orders; this is not durable order idempotency.
  - [ ] Complete remaining mutation/error-state coverage, login delays and end-to-end/browser failure verification.
- [ ] R34: Apply one public visibility predicate across details, images, specs, SKUs, reviews, search, related products, categories, and checkout. Keep an authenticated admin-preview path separate. Inactive/deleted SKUs must not appear as purchasable options.
- [ ] R35: Add server-side pagination/filtering to admin lists, transactions, reviews, audit, coupons, discounts, and products. Use stable sorting and proper total/next-page information. Calculate reports over the intended complete dataset, not the newest 200 records.
- [ ] R36: Define reporting metrics explicitly: collected payments versus booked orders; exclude cancelled/refunded items where appropriate; distinguish order conversion from visitor conversion. Align dashboard, top-product statistics, customer spend, status charts, and transaction totals.
- [ ] R37: Correct invoice output for discounts, long orders, long text, pagination, and relevant Unicode names/addresses. Keep authorization enforced and sensitive PDFs nonpublic/nonindexable. Verify the SKU code selection used in order details.
  - [x] Select and return SKU codes in private/no-store owner-scoped order details; test selection, token/ID validation and ownership.
  - [ ] Complete PDF robustness, Unicode/pagination/discounts and PDF cache/indexing verification.
- [ ] R38: Replace clickable div/span navigation with links/buttons; ensure labels, keyboard operation, visible focus, image alternatives, modal dialog semantics/focus trapping/Escape behavior, reduced-motion support, and mobile layouts. Test checkout/cart overlays and error announcements with assistive technology.

Acceptance: guest→login→variant→cart→quote→order→invoice works; failures do not show false success; filter/variant selection order does not change correctness; full-data reports reconcile; keyboard-only checkout passes.

## 8. Phase 5 — Performance, caching, and try-on resilience

Owners: frontend, backend, operations.

- [ ] R39: Paginate category/search APIs with bounded positive limits, stable order/tie-breakers, and server-side subcategory filters. Fetch subcategories only when their category changes. Avoid downloading full product text and all relations for card views.
- [ ] R40: Share cart/wishlist state and requests across header/page/modal. Fetch counts or lightweight summaries for badges. Batch guest cart enrichment instead of per-line product/SKU requests; avoid fetching the entire wishlist to check one product.
- [x] R41: Load independent cart-migration, shipping, tax and optional address work concurrently; preserve access-check/import/reload dependencies within migration and wait for all resource settlements before enabling retry. Helper tests pass; live browser waterfall measurements remain in R00-7/V03. Product, image, and spec fetches remain parallel.
- [ ] R42: Batch product/SKU reads and order-item writes where safe, keep transactions short, and move noncritical post-order work to a durable queue/outbox. Low-stock checks should inspect affected SKUs and deduplicate alerts atomically, not scan the store before responding. Never rely on unawaited serverless background work for durability.
- [ ] R43: Inspect real `EXPLAIN ANALYZE` plans using representative nonproduction data. Choose PostgreSQL full-text/trigram search and composite indexes based on measured filters/sorts. Validate multilingual needs and spelling behavior. Do not assume existing B-tree indexes accelerate substring search.
- [ ] R44: Define public catalog/config caching and explicit invalidation on publishing, inventory, price, discount activation/expiry, image, and policy changes. Keep customer/session/admin data private and out of shared caches. Ensure SSR price, quote, JSON-LD, and merchant feed stay consistent. Use bounded TTLs for scheduled changes and reconciliation jobs where necessary.
- [ ] R45: Split server-rendered public pages from interactive islands; lazy-load try-on, heavy dialogs, and optional engines. Use responsive images with dimensions/sizes; prioritize only the likely LCP image, lazy-load below-fold content. Replace CSS font imports with optimized/self-hosted font delivery. Restrict image hosts/paths appropriately. Remove unused dependencies only after usage/build checks.
- [ ] R46: Put active CPU person detection in a worker or measured nonblocking alternative; bound image dimensions before decode/inference. Manage bitmap/object-URL/worker/timer lifetimes and cancelled preparation results. Test low-memory and no-WebGPU devices. On-device canvas processing is a separate path and is not assumed to be the current storefront bottleneck.
- [ ] R47: Give try-on an overall deadline, bounded jittered retries, cancellation, per-user quota, service-wide concurrency/cost limits, and asynchronous job status if generation exceeds a normal request budget. Closing/reopening must not apply an old result to a new session. Do not label a failed-open detector as verified. Test provider timeout, 429/5xx, sleeping space, invalid output, failed download/upload, and cleanup failures against safe stand-ins.
- [ ] R48: Pause notification polling in hidden tabs, back off on errors, deduplicate requests, and cap retained audit/notification data. Add indexes for actual lookups only after measurement.

Provisional budgets to validate against the Phase 0 baseline and approved hosting capacity:

| Metric | Proposed acceptance target |
| --- | --- |
| Real-user mobile Core Web Vitals | p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 |
| Public cached reads | p95 ≤ 300 ms from the agreed measurement region |
| Uncached catalog reads | p95 ≤ 800 ms on representative data/load |
| Order creation | p95 ≤ 1.5 s at agreed traffic, excluding external payment/try-on processing |
| Initial JS | Target product ≤ 160 kB and catalog ≤ 140 kB, measured consistently with the existing Next build report; no claim these are universal thresholds |
| Integrity under load | Zero oversells, duplicate idempotent orders, or excess coupon redemptions |

Define catalog size, cart size, concurrent users, test region/device/network, warm/cold runs, and sample duration in each report. Run production builds, not development mode. Field CWV needs real traffic and typically a rolling observation window; Lighthouse alone does not establish it.

## 9. Phase 6 — Full technical and ecommerce SEO

Owners: frontend/backend, SEO/content, operations.

### 9.1 Public architecture and URL migration

- [ ] S01: Keep public home/collection/product shells as server components with server-delivered names, descriptions, prices, stock, breadcrumbs, crawlable links, and metadata. Keep variant/cart/try-on interactions in client components. Reuse trusted data-access functions rather than internal HTTP calls where appropriate; never let user-specific data leak into public rendering.
  - [x] Added server page wrappers for `/customer/product`, `/customer/shop`, and `/customer/category` with server-side metadata/visibility checks. Landing (`/`) now fetches initial categories/featured products server-side, `/customer/shop` fetches initial featured/new-arrivals, `/customer/category` fetches initial products/subcategories, and `/customer/product` now fetches initial product/images/specs/reviews/related server-side for first-render content (partial). Added crawlable breadcrumb UI on product detail and enriched product JSON-LD (category breadcrumb, sale price, images, aggregate rating when present) partially. Full crawlable server-rendered HTML semantics/data reuse coverage, SKU/stock correctness, and live rendering/SEO verification remain pending. Product client UI was restored from `HEAD` during refactor (uncommitted earlier product-page fixes may need reapplication).
- [ ] S02: Add stable unique slugs for products, categories, and subcategories, with slug history/redirect records. Backfill safely and handle collisions. Names may change; identifiers and old links must remain resolvable.
  - [x] Added nullable `slug` fields/indexes in `prisma/schema.prisma`, forward migration `prisma/migrations/202611130003_slugs/migration.sql` (**not applied**), `src/lib/slugs.ts`, `src/lib/slugStore.ts`, `tools/backfill-slugs.mjs` + `db:backfill-slugs`, best-effort slug assignment on product/category/subcategory create, missing-slug fill on admin product/category/subcategory updates (no auto-rename of existing slugs), server-side product ID/slug lookup fallback groundwork, `SlugRedirect` schema + `prisma/migrations/202611130004_slug_redirects/migration.sql` groundwork (**not applied**), and safe `recordSlugRedirect` utility for future controlled slug-change redirect recording.
  - [ ] Pending: safe review/rehearsal/application of slug/redirect migrations, real-data backfill, collision-safe rename handling, redirect record creation/management, slug-based public URLs/links/sitemap/canonicals, and legacy ID redirects.
- [ ] S03: Approve clean public routes such as `/shop`, `/collections/women`, `/collections/men/t-shirts`, `/products/classic-white-tee`, and `/new-arrivals`. These are proposed routes, not implemented paths. Do not rename private/admin routes merely for SEO.
- [ ] S04: Implement one-hop permanent redirects (301/308) from exact legacy URLs: `/customer/product?id=123` to the matching product slug; category URLs to the matching collection; men/women wrappers to their canonical collections. Decide whether home and shop have distinct intent. Return 404 for invalid IDs rather than redirecting everything to home. Update internal links, feeds, canonicals, and sitemaps together; preserve redirects long-term.
  - [x] Added `SlugRedirect` schema + `prisma/migrations/202611130004_slug_redirects/migration.sql` groundwork (**not applied**), `src/lib/slugRedirects.ts` resolver, and initial product-page redirect lookup for missing/non-public `/customer/product?id=...` paths; redirect record creation, broader route coverage (categories/collections/legacy paths), query-parameter preservation, and full 301/308/404/410 behavior remain pending.
- [ ] S05: Implement server-side real not-found handling for missing/unpublished products and invalid collection/page URLs. Verify the actual HTTP status, including streaming behavior; a nice client error component alone is insufficient. Temporary outages should be 503, not permanent 404s.
  - [x] `/customer/product` now calls `notFound()` server-side for missing/non-public IDs; `/customer/category` returns `notFound()` for unknown inactive types when DB lookup succeeds. `src/app/not-found.tsx` is a server component with noindex metadata. Client-fetched 404/503 semantics and full invalid-URL coverage remain pending.

### 9.2 Metadata, sharing, and canonicalization

- [ ] S06: Configure a validated canonical `SITE_URL`/metadata base. Normalize HTTPS, preferred host, case/trailing-slash conventions, and duplicate URL forms without redirect chains. Never derive trusted canonicals from an arbitrary request Host header.
  - [x] Added `src/lib/siteUrl.ts`, `NEXT_PUBLIC_SITE_URL` example, and root `metadataBase`/canonical defaults locally; host normalization, redirect policy and per-page canonicals remain pending.
- [ ] S07: Add unique server-generated titles/descriptions by page type, canonical URLs, Open Graph/Twitter metadata, brand icons, and share-image defaults. Use product/collection-specific descriptions and images. Treat title/description lengths as editorial guidance, not ranking formulas.
  - [x] Server-generated metadata added for product, shop (tab/search-aware, search noindex) and category pages locally, plus root defaults. Icons, share-image defaults, host normalization and full page-type coverage remain pending.
- [ ] S08: Provide admin fields for SEO title/description overrides, useful alt text, slug history, and publication checks. Keep sensible derived defaults; prevent arbitrary script/HTML injection. A metadata field named `tagsMeta` is not a substitute for proper metadata; do not add meta-keyword stuffing.
- [ ] S09: Product variant deep links should preselect a real SKU with the correct price/image/availability. Recommended initial model: one canonical parent product page plus variant query URLs, consistent with `ProductGroup`. If separately indexable color pages are later justified, adopt a deliberate multipage variant policy rather than blanket-parent canonicals.

### 9.3 Indexing and crawl policy

| Page type | Intended policy |
| --- | --- |
| Home, useful shop/collections, published products, useful guides/policies | Indexable; canonical URLs; eligible for appropriate sitemap inclusion |
| Approved high-intent curated facet landing pages | Indexable with useful unique content, stable URLs, and self-canonicals |
| Product variant selectors under the initial single-page model | Crawlable for variant understanding; canonical parent; exclude duplicate selectors from primary sitemap |
| Sort/tracking duplicates | Keep internal links clean; consolidate equivalent content to the appropriate canonical |
| Internal search, low-value filter combinations | Noindex/exclude from sitemaps; separately control crawl expansion based on inventory and indexing state |
| Valid paginated collection pages | Unique URLs, crawlable links, self-canonicals; never canonicalize every page to page one |
| Cart, checkout, sign-in/up, account, admin, order PDFs, staging | Noindex; authentication/access controls where appropriate; never expose private data for SEO |
| Missing/deleted content without a relevant replacement | Correct 404/410, removed from sitemap; useful navigation for visitors |
| Temporarily out-of-stock published products | Usually retain 200/indexable page and truthful OutOfStock offers |

- [ ] S10: Add `src/app/robots.ts` and appropriate page/route robots headers. Robots.txt is crawl guidance, not security. A crawler must be allowed to fetch a page to see `noindex`; do not blindly disallow already-indexed URLs and expect removal. For infinite facet spaces, define crawl restrictions separately after deindexing needs are handled.
  - [x] Added `src/app/robots.ts` and noindex metadata layouts for admin, auth, account and cart routes locally; crawl policy for search/facets/parameters and live verification remain pending.
- [ ] S11: Add `src/app/sitemap.ts` (split into an index if scale requires). Include only canonical, indexable, successful public URLs; exclude search, private paths, redirects, invalid products, and unwanted parameters. Use truthful content-change `lastModified` values, not a fresh timestamp on every request. Invalidate after relevant publishing changes.
  - [x] Added/iterated dynamic `src/app/sitemap.ts` with static fallbacks, best-effort public category/product entries, exclusion of known redirect URLs and inactive-subcategory products, and slug-aware URL selection when available (safe fallback). Canonical slug URL cutover, sitemap index/splitting, invalidation and live DB/URL verification remain pending.
- [ ] S12: Provide crawlable numbered pagination even when adding load-more/infinite scroll. Avoid unbounded filter combinations, duplicate parameter permutations, nonsensical filters, and nonexistent page URLs. Use actual 404s for invalid/no-result facet combinations; distinguish a temporarily empty useful collection from an invalid URL.
- [ ] S13: Create an explicit out-of-stock/discontinued policy. Keep useful temporarily unavailable products; redirect discontinued products only to a genuinely equivalent successor. Do not redirect every discontinued item to its category/homepage. Keep status, structured data, internal links, and feed lifecycle consistent.

### 9.4 Structured data and merchant readiness

- [ ] S14: Server-render valid JSON-LD for `Organization`/appropriate store identity, `WebSite`, `BreadcrumbList`, `Product`, and `Offer`. Use `ProductGroup` with real SKU variants, `productGroupID`, supported `variesBy`, and distinct variant URLs for apparel. Use stable absolute entity IDs and safe serialization.
  - [x] Added root `Organization`/`WebSite` JSON-LD and server-rendered `BreadcrumbList` plus basic `Product`/`Offer` JSON-LD for public product pages locally (base price/currency, conservative availability). `ProductGroup` variants, accurate variant offers/availability, identifiers, shipping/returns and full validation remain pending.
- [ ] S15: Populate real brand, SKU, product images, currency (currently LKR), actual sale price, availability, condition, and product URL. Include genuine GTIN/MPN only where assigned; never manufacture identifiers. Include shipping and merchant return policy data only after business approval. Use `AggregateOffer` only where its semantics fit actual offers, not as a replacement for concrete variant offers.
- [ ] S16: Include ratings/reviews only when genuine, visible, and consistent with the approved public review set. No fabricated ratings, misleading availability, unsupported delivery promises, or blanket FAQ/review markup added solely for stars. Structured-data validation does not guarantee rich-result display.
- [ ] S17: Add automated agreement checks between rendered price/stock, JSON-LD, SKU deep link, quote, and any merchant feed. Handle scheduled sale start/end times and cache invalidation. Test malicious product text cannot break out of JSON-LD scripts.
- [ ] S18: Validate representative templates with Rich Results Test and Search Console URL Inspection. Cover an ordinary product, discounted item, multiple variants, out-of-stock item, collection, and invalid/deleted URL.

### 9.5 Navigation, accessibility, and image discovery

- [ ] S19: Replace `router.push`-only product cards/category navigation with meaningful `<Link href>` anchors. Implement breadcrumbs, collection/subcollection links, related products, and guide-to-product links. Keep important products reachable without site search or customer login.
  - [x] Landing, shop and category product/navigation cards use crawlable `<Link>` anchors locally. Breadcrumb JSON-LD added for product pages, but visible breadcrumbs, related/guide links and broader router-only navigation cleanup remain pending.
- [ ] S20: Give useful pages a clear primary heading and logical sections. Add descriptive image alt text for meaningful product images and empty alternatives for decoration. Preserve responsive dimensions to prevent layout shifts; keep original images crawlable and do not lazy-load the main LCP image. Use a reviewable social image and image sitemap only if needed for discovery.
- [ ] S21: Ensure public content is equivalent for users and search crawlers. No bot-only content, hidden keyword blocks, doorway pages, or ranking guarantees. Prioritize mobile usability and the Phase 5 CWV budgets.

### Proposed SEO implementation locations

| Area | Existing/proposed location |
| --- | --- |
| Global metadata and brand defaults | `src/app/layout.tsx` |
| URL/metadata/structured-data helpers | Proposed `src/lib/seo/` |
| Indexable product route | Proposed `src/app/products/[slug]/page.tsx` |
| Collections | Proposed `src/app/collections/[...segments]/page.tsx`, or explicit routes after taxonomy approval |
| Crawl/sitemap | Proposed `src/app/robots.ts`, `src/app/sitemap.ts` |
| Redirects and trusted-host policy | `next.config.js` and server route handlers where DB lookup is necessary |
| Slugs/history/SEO fields | `prisma/schema.prisma` and new forward migrations |
| Shared visible content | `src/components/CustomerHeader.tsx`, `CustomerFooter.tsx`, catalog components |

Acceptance: initial server HTML contains useful public product content and valid metadata/JSON-LD; legacy redirects resolve correctly; no accidental staging/private indexing; sitemap and canonicals agree; no redirect loops/soft-404s; paginated/variant policies are tested; a crawl finds no orphaned published products.

## 10. Phase 7 — Content SEO, trust, and discovery

Owners: SEO/content, business owner; engineering for templates and feeds.

- [ ] S22: Research category/product search intent for the confirmed market. Map one primary intent to each useful landing page, avoiding overlapping thin collections. Use Search Console data when available; do not invent search volumes.
- [ ] S23: Improve every published product with factual materials, fit, sizing, measurements, care, available colors, photography, shipping/returns summary, and a unique helpful description. Publish collection introductions and helpful navigation without burying products below large SEO text blocks.
- [ ] S24: Add trustworthy About, Contact, Shipping, Returns/Refunds, Privacy, Terms, sizing, and care pages. Display approved business/support details and honest payment-at-delivery wording consistently. Add a verified business profile/local-business data only if an eligible real physical business exists.
- [ ] S25: Publish useful editorial content such as garment care, size selection, and styling guides that demonstrate actual product knowledge. Add authors/review responsibility and relevant collection/product links. Maintain an editorial update schedule; avoid mass-generated near-duplicate pages.
- [ ] S26: If the target country/currency/products are eligible, set up Google Merchant Center free listings and an accurate product/variant feed. Include stable IDs/group IDs, landing links, title, description, images, price/currency, availability, brand/identifiers, and apparel attributes as required. Align shipping/returns and account diagnostics with site policies. Do not promise eligibility before checking it.
- [ ] S27: Add `hreflang` only for genuine translated/localized pages, with self/reciprocal references and appropriate canonicals. Do not create empty language variants. Confirm English/regional locale and currency formatting even if the initial launch is single-language.
- [ ] S28: Build legitimate discovery through brand profiles, relevant partnerships, editorial mentions, and useful shareable content. No purchased link schemes, fake reviews, or bulk directory spam.

Acceptance: business-approved facts/policies, substantive product content, truthful feed diagnostics, working support links, and no fabricated structured-data claims.

## 11. Phase 8 — Verification, release, ongoing operations

Owners: all responsible roles.

- [ ] V01: Add repeatable unit tests for money, discount selection, coupon bounds, zero config, payload schemas, canonical/slug rules, and metadata serialization.
- [ ] V02: Add real PostgreSQL integration tests for checkout concurrency, coupon limits, cart uniqueness, idempotency, role revocation, rollback, SKU history, and migration upgrade paths. Use isolated per-run data and explicit cleanup.
- [ ] V03: Add browser tests for guest-cart merge, selection order, rapid navigation, HTTP failures, expired sessions, checkout, order/payment display, PDFs, mobile navigation, keyboard access, and try-on cancellation.
- [ ] V04: Test Cloudinary/Hugging Face failure paths with safe HTTP stand-ins before limited live integration smoke tests. Do not send personal data, incur generation costs, or mutate production as part of routine CI.
- [ ] V05: Add a reproducible ESLint setup and CI jobs for clean installation, generated Prisma client, lint, types, tests, production build, dependency scanning, migration checks, final-container smoke tests, and production-mode performance/SEO checks. Test only supported Node versions; never commit credentials.
- [ ] V06: Add SEO assertions for correct HTTP status, initial HTML, unique metadata, canonical consistency, noindex policy, redirects, sitemap exclusions, crawlable links, and JSON-LD price/stock agreement. Crawl staging using authorized access; validate public representative pages after release.
- [ ] V07: Deploy schema changes with expand/backfill/contract where needed. Release compatible backend/frontend changes together or with a documented overlap. Roll out auth, checkout, caching, and URL changes with flags/canaries; keep redirects active across application rollback.
- [ ] V08: Alert on order failures/duplicates, negative inventory, unexpected price/tax changes, failed jobs, provider cost/quota spikes, upload retention failures, DB pool pressure, slow queries, and readiness failures. Record a baseline error budget and on-call owner.
- [ ] V09: Verify Search Console domain ownership, submit sitemap, inspect representative URLs, and monitor canonical selection, indexing exclusions, crawl errors, product/merchant enhancements, and security/manual-action reports. Submit Bing where useful. Never automate mass URL indexing requests as a substitute for crawlable architecture.
- [ ] V10: Track consent-aware business analytics: product view, variant selection, cart addition, checkout start, purchase, cancellation/refund. Deduplicate purchases by trusted order ID and exclude personal data. Do not equate orders/users with visitor conversion.
- [ ] V11: Review organic landing-page clicks/impressions, CTR, nonbrand visibility, organic orders/revenue, merchant diagnostics, and field CWV weekly initially and monthly after stability. Investigate device/template differences. Rankings, indexing speed, and rich results are not guaranteed.

### Mandatory release gates

1. No unresolved order-integrity or sensitive-data P0 findings.
2. Fresh install, existing-data migration, and backup restore demonstrated.
3. Concurrent stock/coupon/idempotency tests pass on real PostgreSQL.
4. Security tests pass; remaining advisory exceptions have explicit owners/expiry.
5. Customer/admin workflows and third-party failure recovery pass.
6. Public pages meet agreed performance budgets or have measured, approved exceptions.
7. Legacy redirects, server HTML, canonical/noindex rules, sitemap, and structured data are verified.
8. Staging remains protected; production is not accidentally noindexed or robots-blocked.
9. Monitoring, rollback instructions, migration compatibility, and release ownership are recorded.

## 12. Coverage of the reviewed findings

Use these IDs when opening issues/PRs. A finding is not closed by merging code alone; attach the listed phase's verification evidence.

| Reviewed finding/group | Backlog coverage |
| --- | --- |
| Negative/invalid quantity; stock increases; duplicate/concurrent oversell | R01, R03, V02 |
| SKU omission/quick-add inventory bypass; client names/specs | R02, R32 |
| Duplicate orders on retry; newly added cart items removed at checkout | R04, R10 |
| Zero tax becomes 8%; money/rounding consistency | R05, R08 |
| Coupon overuse, negative coupon surcharge, stale discount preview | R06, R08, V02 |
| 150% partial discount update; ignored target-only update | R07 |
| Cancellation/refund stock/coupon behavior; false paid status | R09, R36 |
| Cart lost additions/duplicate rows; nullable wishlist uniqueness | R10, R23 |
| Affected dependencies/framework; outdated browser tooling | R11, V05 |
| Password hash in profile output | R12 |
| JWT inconsistency, invalid token 500, stale roles/active status | R13, R14 |
| JS-readable token/cookie; public AES key boundary | R13, R17, R18 |
| Missing abuse controls and registration validation | R15 |
| Predictable seeded administrator credentials | R16 |
| User input interpolated into HTML | R18 |
| Unbounded/unvalidated uploads and external download safety | R19 |
| Personal photo retention/disclosure/access | R20 |
| Client-spoofable audit events; missing admin audit coverage | R21 |
| Ten missing migration tables and schema drift | R22 |
| Missing DB invariants, duplicate nullable identities | R23 |
| Obsolete/unused container deployment; missing public assets; runtime mismatch; DB URL mismatch | R24 |
| Model setup failures do not stop deployment | R25 |
| Partial product deletion; lost specs; destructive/explosive SKU regeneration | R26 |
| Partial settings writes despite rejection; multiple/no active shipping; common-index races | R27 |
| Cached/static health check, always-200 readiness, raw DB errors | R28 |
| Production error logs stripped; operational visibility gaps | R29, V08 |
| README MySQL/SSR/setup mismatch; unsafe production setup assumptions | R30 |
| Guest cart discarded or removed after failed migration | R31 |
| Stale SKU, selection-order matching, stale async response/timers | R32 |
| False-success UI, blank/error handling, artificial delays | R33 |
| Draft/deleted product exposure; inactive SKUs; missing public visibility filters | R02, R34 |
| Admin 200-row truncation and incorrect full-data reports | R35, R36 |
| Invoice robustness and missing SKU detail | R37 |
| Nonsemantic navigation, modal focus, accessibility/mobile gaps | R38, S19, S20 |
| Unbounded category results/refiltering and expensive substring search | R39, R43 |
| Badge full downloads, duplicate wishlist requests, guest N+1 requests | R40 |
| Sequential checkout initialization | R41 |
| Sequential transaction work and low-stock N+1 scan before response | R42 |
| Public/private cache boundaries and price freshness | R44, S17 |
| Client-only catalog dependency, heavy optional JS, image/font loading | R45, S01, S20 |
| CPU person detection, image memory, unused on-device resources | R46 |
| Try-on quota/deadline/retries/cancellation/fail-open verification | R47, V04 |
| Polling/notification/audit growth | R48 |
| Missing automated tests, lint, reproducible contract/CI | R00-4, R00-5, V01–V06 |
| SEO discovery/rendering/URLs/metadata/structured data | S01–S21 |
| Full content/trust/localization/merchant/off-page SEO | S22–S28 |
| Live performance, DB concurrency, real indexing remain unverified | R00-7, V02, V06, V09–V11 |

## 13. First ten implementation tickets

1. Create isolated PostgreSQL fixtures, backup/restore rehearsal, and failing regression tests (R00).
2. Validate quantities, required variants, trusted product data, and invalid auth (R01, R02, R14).
3. Implement atomic inventory/coupon reservation and durable order idempotency (R03, R04, R06).
4. Fix zero tax, negative pricing/coupons, discount PATCH behavior, and quote consistency (R05–R08).
5. Remove profile hash output, rotate default admin credentials, contain expensive endpoints, and start the dependency upgrade (R11, R12, R15, R16).
6. Repair migration history strategy, Vercel runtime/assets, and readiness probes (R22-R25, R28).
7. Make destructive admin operations and settings/shipping atomic/history-safe (R26, R27).
8. Fix guest-cart merge, variant matching, false-success UI, and payment display (R09, R31–R34).
9. Measure and fix unbounded reads, duplicate requests, checkout waterfalls, low-stock scans, and try-on resilience (R39–R48).
10. Deliver server-rendered public templates, slugs/redirects, metadata, sitemap/robots, structured data, and approved content (S01–S28).

## 14. SEO reference guidance

Implementation references reviewed while preparing this roadmap; recheck required properties and platform support when implementing:

- [Google: ecommerce URL structure](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites)
- [Google: product variant structured data](https://developers.google.com/search/docs/appearance/structured-data/product-variants)
- [Google: faceted navigation crawl management](https://developers.google.com/search/docs/crawling-indexing/crawling-managing-faceted-navigation)
- [Google: ecommerce pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- [Google: merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Google: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)


## 15. Intelligent recommendation and customer engagement system

Implemented locally as an additive, privacy-aware, modular feature set (no paid APIs/services, no deployment/commit/push).

### 15.1 Project analysis (Phase 1)

- **Stack:** Next.js 16.4.6 App Router, React 18, TypeScript, Prisma/PostgreSQL, route handlers under `src/app/api`, CSS modules/global tokens, JWT auth with active-user/session checks, Cloudinary/encryption/rate-limit/readiness utilities.
- **Reusable existing pieces:** public catalog/select/discount helpers (`src/lib/publicCatalog.ts`, `publicProduct.ts`, `discounts.ts`), auth middleware (`apiMiddleware.ts`), validation patterns (`validation.ts`), cart/wishlist/order/profile APIs and pages, global `ClientWrapper`, product/shop/category/search/cart/account surfaces, existing audit hooks (`useAuditTrail`, `useActivityTracker`, `/api/audit`).
- **Gaps identified:** no customer preference/opt-out storage, no behavioral event store for personalization, no recommendation rules/history, no trigger manager or assistant UI, no guest-session recommendation flow beyond generic browsing.

### 15.2 Architecture and design (Phase 2)

- **Client event collector:** `EngagementProvider` (`src/lib/engagement/tracker.tsx`) tracks page views, active dwell (visibility-aware), scroll depth, and explicit events with in-memory batching, periodic/visibility/pagehide flush, payload caps, and checkout suppression. Session-scoped ID (`src/lib/engagement/session.ts`); works for guests and authenticated users.
- **Trigger manager / assistant:** `src/components/recommendations/ShoppingAssistant.tsx` requests server suggestions after configurable dwell/event triggers, enforces route-key reset, local dismiss/snooze windows, shown-key dedupe, single-panel display, and checkout/auth/cart suppression; records interactions via API.
- **Recommendation engine:** `src/lib/recommendations/engine.ts` loads consent/preferences/history/signals, evaluates prioritized configurable rules (`rules.ts`), generates candidates from active public in-stock catalog data, applies weighted scoring (`scoring.ts`) and availability/relevance filtering, selects one next-best action, and logs impressions best-effort.
- **Configurable rules/thresholds (initial):** active browsing without action (>=90s active, >=30% scroll), repeated product view (>=2), similar/comparison browsing (>=3 recent items), returning to previously viewed item (authenticated), unavailable selection, in-budget browsing, and cart inactivity with items. Each rule defines priority, cooldown, max-per-session, page suppressions, and action/CTA.
- **Weighted ranking factors:** category similarity, preference/history affinity, purchase/wishlist affinity, price relevance, availability, size-fit placeholder, and session activity; normalized scores with `rankProducts` for deterministic ordering. Interface is modular for future ML ranking.
- **Next-best actions:** view similar/alternatives, compare options, open details/size help, save/view wishlist, continue/review bag, explore category/options, ask assistance (copy/CTAs grounded in real routes/data).

### 15.3 Database changes (Phase 3, additive)

- `user_preferences`: per-user `personalization_enabled`, consent timestamp, optional preference fields (sizes/colors/categories/styles/price range), timestamps; unique user FK, opt-out index.
- `engagement_events`: session/user linkage, event type/page/product/category/search refs, active ms/scroll depth, bounded metadata JSON, created timestamp, indexes for user/session/event/product/time.
- `recommendation_rules`: configurable key/name/enabled/priority/trigger/conditions/action/cooldowns/frequency/page scope/suppression JSON, timestamps, unique key and lookup indexes.
- `recommendation_logs`: session/user, rule/action, page/context/product IDs, status (`shown/clicked/dismissed/snoozed/converted`), snooze-until, timestamps, indexes for session/user/rule/status/time.
- **Safety:** forward-only additive migration, no drops/renames of existing tables/columns, nullable user linkage for guest/session-safe records, bounded payloads/indexes, consent gate for authenticated event storage.

### 15.4 Implementation files

- **Schema/migration:** `prisma/schema.prisma`, `prisma/migrations/202611160002_recommendations_engagement/migration.sql`.
- **Server libs:** `src/lib/recommendations/types.ts`, `rules.ts`, `scoring.ts`, `engine.ts`.
- **APIs:** `src/app/api/recommendations/events/route.ts`, `src/app/api/recommendations/suggest/route.ts`, `src/app/api/recommendations/interactions/route.ts`, `src/app/api/personalization/preferences/route.ts`.
- **Client/tracking/UI:** `src/lib/engagement/session.ts`, `src/lib/engagement/tracker.tsx`, `src/components/recommendations/ShoppingAssistant.tsx`, `src/components/recommendations/ShoppingAssistant.module.css`, `src/components/ClientWrapper.tsx`.
- **Integrations:** `src/app/customer/product/ProductClient.tsx`, `src/app/customer/shop/ShopClient.tsx`, `src/app/customer/account/profile/page.tsx`.
- **Tests:** `tests/recommendations.test.cjs` (rule thresholds/actions/suppression/cooldown-frequency metadata, weighted scoring/ranking bounds).

### 15.5 Privacy, security, performance

- No login required for suggestions; guests receive session/context-based recommendations.
- Authenticated personalization/event linkage is optional and disabled by account opt-out (`/api/personalization/preferences`, profile UI). Event ingest returns accepted=0 when opted out.
- Server endpoints enforce active-user checks where required, validate/bound inputs, return `Cache-Control: private, no-store`, avoid sensitive/internal data exposure, and fail safe (suggest/events degrade to no-op/disabled rather than breaking shopping).
- Tracking is lightweight/batched (active-time, throttled flush, max event batch/payload sizes, checkout suppression); no paid services; no auth/checkout core behavior changes.
- Recommendations use real catalog/availability/price data; messages are helpful and non-assertive (no claims about customer feelings/intent).

### 15.6 Testing and evaluation (Phase 4)

- **Automated:** rule and scoring tests added/passing for dwell, repeat view, comparison, returning-auth-only, unavailable selection, budget, cart inactivity, suppression/cooldown/session-limit definitions, and ranking/bounded scores.
- **Local verification:** `npm test` 193/193 pass; `npm run typecheck` pass; `npm run lint` 0 errors/37 warnings; `npm run build` pass; `npm run check:migrations` pass; `npm run db:status` up to date; `npm run db:diff` clean; recommendation migration applied to configured DB.
- **Scenario coverage (implemented support):** guest/product/category/search/cart browsing signals, authenticated preference/opt-out, repeat/similar/unavailable/cart-inactive triggers, dismiss/snooze/click interactions, checkout suppression, mobile-responsive panel and keyboard-accessible controls. Full browser/E2E/mobile/perf/CWV and live conversion analytics remain pending.

### 15.7 ML extension path (Phase 5)

- Keep `scoring.ts`/`engine.ts` interfaces stable: candidate features can be enriched from aggregated events/preferences/orders; replace or blend `scoreProduct` with a model inference service or offline-trained weights loaded from config.
- `recommendation_rules` and `AppSetting`/config can store model version, feature flags, and A/B buckets; `recommendation_logs` + interaction statuses provide labeled impression/click/conversion signals for evaluation/training pipelines (subject to consent/retention policy).
- Add offline jobs for feature aggregation, retention cleanup, and metric dashboards before introducing ML; validate fairness/privacy and rollout behind flags.


Completion means the relevant acceptance evidence exists, not that every checkbox was ticked without testing. SEO is an ongoing measured program, not a promise of first-page rankings.
