-- Forward-only groundwork for R14 session revocation/versioning. Not applied.
BEGIN;

ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

COMMIT;
