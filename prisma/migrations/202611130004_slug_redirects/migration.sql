-- Forward-only groundwork for S02/S04 slug history and retired URL redirects.
-- Not applied. Review/rehearse before applying; pair with redirect resolution logic.
BEGIN;

CREATE TABLE "slug_redirects" (
    "slug_redirect_id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("slug_redirect_id")
);

CREATE UNIQUE INDEX "slug_redirects_from_path_key" ON "slug_redirects"("from_path");
CREATE INDEX "slug_redirects_entity_type_entity_id_idx" ON "slug_redirects"("entity_type", "entity_id");
CREATE INDEX "slug_redirects_is_active_idx" ON "slug_redirects"("is_active");

COMMIT;
