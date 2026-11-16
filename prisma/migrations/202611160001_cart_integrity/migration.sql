-- PostgreSQL 15+: NULLS NOT DISTINCT also protects genuinely SKU-less lines.
-- Refuse legacy duplicates/invalid quantities; never silently discard saved bags.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "cart_items" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_bounds" CHECK ("quantity" BETWEEN 1 AND 1000);
CREATE UNIQUE INDEX "cart_items_user_id_product_id_sku_id_key" ON "cart_items"("user_id", "product_id", "sku_id") NULLS NOT DISTINCT;

-- All writers, including older clients, advance the revision. ABA quantity changes
-- cannot make a stale checkout snapshot appear current again.
CREATE FUNCTION cart_items_advance_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cart_items_revision BEFORE UPDATE ON "cart_items"
  FOR EACH ROW EXECUTE FUNCTION cart_items_advance_revision();

CREATE TABLE "cart_merge_requests" (
    "cart_merge_request_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_merge_requests_pkey" PRIMARY KEY ("cart_merge_request_id")
);
CREATE UNIQUE INDEX "cart_merge_requests_user_id_key_key" ON "cart_merge_requests"("user_id", "key");
CREATE INDEX "cart_merge_requests_created_at_idx" ON "cart_merge_requests"("created_at");
ALTER TABLE "cart_merge_requests" ADD CONSTRAINT "cart_merge_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
