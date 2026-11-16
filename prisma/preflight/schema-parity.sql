-- READ ONLY. Run on an isolated restore matching 0_init before parity migration.
-- Counts only; do not automatically delete or rewrite customer/order data.
SELECT 'order_items_missing_product' AS issue, COUNT(*) AS affected
FROM "order_items" i LEFT JOIN "products" p ON p."product_id" = i."product_id"
WHERE p."product_id" IS NULL;

SELECT 'order_items_missing_sku' AS issue, COUNT(*) AS affected
FROM "order_items" i LEFT JOIN "product_skus" s ON s."product_sku_id" = i."sku_id"
WHERE i."sku_id" IS NOT NULL AND s."product_sku_id" IS NULL;

SELECT 'cart_items_missing_product' AS issue, COUNT(*) AS affected
FROM "cart_items" c LEFT JOIN "products" p ON p."product_id" = c."product_id"
WHERE p."product_id" IS NULL;

SELECT 'cart_items_missing_sku' AS issue, COUNT(*) AS affected
FROM "cart_items" c LEFT JOIN "product_skus" s ON s."product_sku_id" = c."sku_id"
WHERE c."sku_id" IS NOT NULL AND s."product_sku_id" IS NULL;

SELECT 'cart_sku_product_mismatch' AS issue, COUNT(*) AS affected
FROM "cart_items" c JOIN "product_skus" s ON s."product_sku_id" = c."sku_id"
WHERE c."product_id" <> s."product_id";

SELECT 'order_sku_product_mismatch' AS issue, COUNT(*) AS affected
FROM "order_items" i JOIN "product_skus" s ON s."product_sku_id" = i."sku_id"
WHERE i."product_id" <> s."product_id";

SELECT 'invalid_cart_quantity' AS issue, COUNT(*) AS affected FROM "cart_items" WHERE "quantity" <= 0;
SELECT 'invalid_order_quantity' AS issue, COUNT(*) AS affected FROM "order_items" WHERE "quantity" <= 0;
SELECT 'negative_stock' AS issue, COUNT(*) AS affected FROM "product_skus" WHERE "stock" < 0;
SELECT 'active_shipping_rows' AS issue, COUNT(*) AS affected FROM "shipping_fees" WHERE "is_active" = true;
