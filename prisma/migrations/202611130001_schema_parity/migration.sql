-- Forward-only parity with the application schema; do not modify 0_init.
-- NOT blindly applicable to databases previously managed with db push.
-- Review docs/database-migration-runbook.md, backups and orphan checks first.
-- This changes no existing order statuses/data; it only fixes the default.
BEGIN;

ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "users" ADD COLUMN "date_of_birth" TIMESTAMP(3);

CREATE TABLE "try_on_spaces" (
    "try_on_space_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "space_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'none',
    "error" TEXT,
    "used_today" INTEGER NOT NULL DEFAULT 0,
    "usage_date" TEXT,
    "package_status" TEXT NOT NULL DEFAULT 'none',
    "package_expires_at" TIMESTAMP(3),
    "package_daily_limit" INTEGER NOT NULL DEFAULT 0,
    "package_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "try_on_spaces_pkey" PRIMARY KEY ("try_on_space_id")
);

CREATE TABLE "try_on_payments" (
    "payment_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL,
    "provider_cut" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'demo_paid',
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "try_on_payments_pkey" PRIMARY KEY ("payment_id")
);

CREATE TABLE "try_on_free_pools" (
    "pool_id" SERIAL NOT NULL,
    "pool_date" TEXT NOT NULL,
    "used_today" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "try_on_free_pools_pkey" PRIMARY KEY ("pool_id")
);

CREATE TABLE "app_settings" (
    "setting_id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("setting_id")
);

CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipient" TEXT NOT NULL DEFAULT 'admin',
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

CREATE TABLE "ad_banners" (
    "banner_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "position" TEXT NOT NULL DEFAULT 'home',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ad_banners_pkey" PRIMARY KEY ("banner_id")
);

ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "orders" ADD COLUMN "coupon_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "product_discount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "coupon_id" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "original_price" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "wishlist_items" (
    "wishlist_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("wishlist_id")
);

CREATE TABLE "reviews" (
    "review_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

CREATE TABLE "coupons" (
    "coupon_id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL DEFAULT 'percentage',
    "discount_value" DECIMAL(10,2) NOT NULL,
    "min_subtotal" DECIMAL(10,2),
    "max_discount" DECIMAL(10,2),
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("coupon_id")
);

CREATE TABLE "discounts" (
    "discount_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL DEFAULT 'percentage',
    "discount_value" DECIMAL(10,2) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'product',
    "product_id" INTEGER,
    "category_id" INTEGER,
    "sub_category_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discounts_pkey" PRIMARY KEY ("discount_id")
);

CREATE UNIQUE INDEX "try_on_spaces_user_id_key" ON "try_on_spaces"("user_id");
CREATE INDEX "try_on_payments_user_id_idx" ON "try_on_payments"("user_id");
CREATE INDEX "try_on_payments_created_at_idx" ON "try_on_payments"("created_at");
CREATE UNIQUE INDEX "try_on_free_pools_pool_date_key" ON "try_on_free_pools"("pool_date");
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");
CREATE INDEX "notifications_recipient_is_read_idx" ON "notifications"("recipient", "is_read");
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");
CREATE INDEX "ad_banners_position_is_active_idx" ON "ad_banners"("position", "is_active");
CREATE INDEX "products_prod_price_idx" ON "products"("prod_price");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX "audit_trails_created_at_idx" ON "audit_trails"("created_at");
CREATE INDEX "wishlist_items_user_id_idx" ON "wishlist_items"("user_id");
CREATE INDEX "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");
CREATE UNIQUE INDEX "wishlist_items_user_id_product_id_sku_id_key" ON "wishlist_items"("user_id", "product_id", "sku_id");
CREATE INDEX "reviews_product_id_idx" ON "reviews"("product_id");
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");
CREATE UNIQUE INDEX "reviews_user_id_product_id_key" ON "reviews"("user_id", "product_id");
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_is_active_idx" ON "coupons"("is_active");
CREATE INDEX "discounts_scope_is_active_idx" ON "discounts"("scope", "is_active");
CREATE INDEX "discounts_product_id_idx" ON "discounts"("product_id");
CREATE INDEX "discounts_category_id_idx" ON "discounts"("category_id");
CREATE INDEX "discounts_sub_category_id_idx" ON "discounts"("sub_category_id");

-- These FKs can fail on legacy orphan rows; inspect and repair deliberately.
ALTER TABLE "try_on_spaces" ADD CONSTRAINT "try_on_spaces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "try_on_payments" ADD CONSTRAINT "try_on_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "try_on_spaces"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("coupon_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("product_sku_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("product_sku_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "product_skus"("product_sku_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "subcategories"("sub_category_id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
