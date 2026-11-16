-- Forward-only slug foundation for S02. Nullable to allow safe backfill.
-- Do not apply without reviewing existing data, uniqueness and redirect strategy.
BEGIN;

ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "categories" ADD COLUMN "slug" TEXT;
ALTER TABLE "subcategories" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE UNIQUE INDEX "subcategories_category_id_slug_key" ON "subcategories"("category_id", "slug");

COMMIT;
