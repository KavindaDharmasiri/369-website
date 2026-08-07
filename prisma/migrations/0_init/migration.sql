-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "user_type" TEXT NOT NULL DEFAULT 'customer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "stock_status" BOOLEAN NOT NULL DEFAULT true,
    "prod_market" TEXT NOT NULL DEFAULT 'DRAFT',
    "prod_type" TEXT NOT NULL DEFAULT 'Product',
    "prod_category_name" TEXT,
    "prod_name" TEXT NOT NULL,
    "prod_subtitle" TEXT,
    "prod_description" TEXT NOT NULL,
    "prod_img" TEXT NOT NULL,
    "prod_price" DECIMAL(10,2) NOT NULL,
    "charge_tax" BOOLEAN NOT NULL DEFAULT false,
    "tags_category" TEXT,
    "tags_meta" TEXT,
    "tags_ga4" TEXT,
    "featured_on_homepage" BOOLEAN NOT NULL DEFAULT false,
    "show_in_new_arrivals" BOOLEAN NOT NULL DEFAULT false,
    "return_policy_doc" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "base_sku" TEXT,
    "prod_sub_category_name" TEXT,
    "category_id" INTEGER NOT NULL,
    "sub_category_id" INTEGER NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "shipping_fee" DECIMAL(10,2) NOT NULL,
    "state" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "zip_code" TEXT NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "specs" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "sub_category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("sub_category_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "product_image_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_image_id")
);

-- CreateTable
CREATE TABLE "product_specs" (
    "product_spec_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order_no" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_specs_pkey" PRIMARY KEY ("product_spec_id")
);

-- CreateTable
CREATE TABLE "product_spec_attrs" (
    "product_spec_attr_id" SERIAL NOT NULL,
    "spec_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_spec_attrs_pkey" PRIMARY KEY ("product_spec_attr_id")
);

-- CreateTable
CREATE TABLE "product_skus" (
    "product_sku_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku_code" TEXT NOT NULL,
    "variant_keys" TEXT,
    "variant_details" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_skus_pkey" PRIMARY KEY ("product_sku_id")
);

-- CreateTable
CREATE TABLE "common_indexes" (
    "common_index_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "common_indexes_pkey" PRIMARY KEY ("common_index_id")
);

-- CreateTable
CREATE TABLE "audit_trails" (
    "audit_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "user_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" TEXT,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_trails_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "cart_item_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sku_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "specs" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("cart_item_id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "address_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "shipping_fees" (
    "shipping_fee_id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_fees_pkey" PRIMARY KEY ("shipping_fee_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "products_status_prod_market_is_deleted_idx" ON "products"("status", "prod_market", "is_deleted");

-- CreateIndex
CREATE INDEX "products_prod_category_name_idx" ON "products"("prod_category_name");

-- CreateIndex
CREATE INDEX "products_featured_on_homepage_idx" ON "products"("featured_on_homepage");

-- CreateIndex
CREATE INDEX "products_show_in_new_arrivals_idx" ON "products"("show_in_new_arrivals");

-- CreateIndex
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_sub_category_id_idx" ON "products"("sub_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_order_number_idx" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "categories"("name");

-- CreateIndex
CREATE INDEX "subcategories_category_id_is_active_idx" ON "subcategories"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "subcategories_name_idx" ON "subcategories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_name_category_id_key" ON "subcategories"("name", "category_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "product_specs_product_id_idx" ON "product_specs"("product_id");

-- CreateIndex
CREATE INDEX "product_spec_attrs_spec_id_idx" ON "product_spec_attrs"("spec_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_skus_sku_code_key" ON "product_skus"("sku_code");

-- CreateIndex
CREATE INDEX "product_skus_product_id_idx" ON "product_skus"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "common_indexes_name_key" ON "common_indexes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "common_indexes_code_key" ON "common_indexes"("code");

-- CreateIndex
CREATE INDEX "audit_trails_user_id_idx" ON "audit_trails"("user_id");

-- CreateIndex
CREATE INDEX "audit_trails_action_idx" ON "audit_trails"("action");

-- CreateIndex
CREATE INDEX "audit_trails_entity_type_idx" ON "audit_trails"("entity_type");

-- CreateIndex
CREATE INDEX "cart_items_user_id_idx" ON "cart_items"("user_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "subcategories"("sub_category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_specs" ADD CONSTRAINT "product_specs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_spec_attrs" ADD CONSTRAINT "product_spec_attrs_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "product_specs"("product_spec_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
