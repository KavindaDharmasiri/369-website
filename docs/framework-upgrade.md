# Next.js 16 upgrade

Next.js is pinned to **16.4.6**, replacing 14.2.35. Route-handler params and public
page searchParams are awaited; awaiting plain objects still permits existing
offline fixtures, but new regression tests also cover promised inputs.

`src/proxy.ts` replaces `src/middleware.ts`. It uses shared token verification and
current active-account checks for protected paths; path matching uses segment
boundaries so `/customer/product-private` is not mistaken for public product
content. Proxy is only the page-navigation gate: route handlers still perform
their own authorization. Session-version schema is now applied on the authorized DB;
that alone does not establish complete session-lifecycle/browser coverage.

Build and dev explicitly select webpack for compatibility with the existing
media dependencies. Dev binds to loopback by default and uses `.next-dev`; builds
use `.next`. Next 16 further nests dev output under `dev/`. Do not run an old
Next 14 dev process against newly installed packages: restart it with `npm run dev`.
Image qualities are explicitly allowlisted as 75 and 85, matching the current hero.
`tsconfig.build.json` and `types/build-env.d.ts` isolate production type checking from
dev-generated route types and the shared auto-rewritten `next-env.d.ts`. A concurrent
dev process had removed transient files mid-check; the isolated build passed afterward.

Next 16 still supports React 18 but reports its deprecation ahead of Next 17.
React 19 migration remains separate rather than being silently forced into this
security upgrade. Use a current Node 22 LTS release (22.13+ for all lint tooling)
or compatible Node 24 LTS. This machine's 22.12 successfully built the app but
reported lint dependency engine warnings; that is not supported-toolchain evidence.

`next lint` was removed in Next 16. `npm run lint` now uses ESLint 9 with the
official flat core-web-vitals configuration. The initial scan exposed legacy
effect-state and function-ordering violations. They remain enforced, not disabled
to produce a green job; refer to the roadmap for the latest measured counts.

The minimatch 11.0.1 override is scoped to the dev-only TypeScript ESLint parser
dependency to address GHSA-g3hv-75wg-m249 without downgrading Next's ESLint config.
Re-run lint/parser checks and the full audit when updating it; remove the override
once upstream carries a fixed compatible dependency.

Observed checks: Next 16 webpack production build passed; the latest **189/189**
offline tests passed, including promised-input/proxy, client auth store, landing
render, private DTO, durable cart/lifecycle/readiness/polling/logging/auth-navigation
and exact checkout-quote checks. Full npm audit reports **zero vulnerabilities**. ESLint **passes with 0 errors** (39
warnings remain and are not release-complete evidence). Prisma client generation
and structural migration checks passed; TypeScript passed.

Read-only Next 16 dev smoke checks on port 3100 previously returned 200 for home,
search, category, SKU deep-link product, sitemap and product API when the database
was reachable. A later production-server smoke returned 200 for home, search,
category, sitemap, robots and product API, but the SKU product page hit a database
connection failure in that environment and did not produce browser confirmation.
The November 16 final-build follow-up returned 200 for that SKU product page and
verified rendering/reselection without console errors. A separate isolated-schema
browser flow completed guest add→sign-in→durable import→order→private details;
the discovered prefetched guest-redirect issue was fixed and retested. This is
limited manual acceptance, not a comprehensive automated browser suite.

Production deployment, full backup/restore rehearsal, complete browser interaction/
accessibility coverage, React 19 migration, and supported Node toolchain remain
separate release gates. See the roadmap for newer PostgreSQL concurrency evidence,
cart-integrity migration application and current test counts.

The latest client/runtime pass uses a hydration-aware external store for display
identity, derives account tabs from the URL, keys sensitive sessions by identity,
treats empty server-rendered catalog windows as resolved, and avoids exposing
internal product actor/tag fields from private cart/wishlist reads. Offline tests
and static/build checks cover these changes; they are not substitutes for live
database, browser, or deployment evidence.
