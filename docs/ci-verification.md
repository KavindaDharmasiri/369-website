# Verification workflow

`.github/workflows/verification.yml` runs on PRs, main/master pushes and manual
dispatch. It has read-only repository permissions and no deployment, migration,
seed, publishing, production database, or provider credentials.

The application job runs locked installation, Prisma generation, offline tests,
structural migration checks, production compilation and TypeScript verification
on Node 22. Installation scripts are skipped to avoid invoking provider asset
setup in PRs. This job is a compilation/safety gate, not a deployable artifact
or proof that optional try-on assets are installed.

A separate audit job fails on high/critical advisories. Framework advisories are
not waived; Next 16.4.6 now passes the production dependency audit. The lint job
passes locally with no rule suppressions; remaining warnings still need review.
Type checks use `tsconfig.build.json` so a concurrent development server cannot
delete/rewrite files underneath the production checker.
Configure both jobs as required branch-protection checks in the repository host;
adding a YAML file alone does not enable branch protection.

This workflow has been authored locally; an actual hosted CI run has not yet been
observed. The opt-in `npm run test:postgres` harness provides isolated-schema migration,
concurrency, rollback and checkout-quote checks on an authorized PostgreSQL database,
not public fixtures or provider calls. It is not enabled automatically on PRs or against
production secrets in this workflow. Full backup/restore rehearsal,
browser tests, provider HTTP simulation, Vercel runtime checks, accessibility,
SEO crawling, field performance and approved deployment gates remain separate
requirements. Offline handler tests and migration SQL coverage do not satisfy them.
