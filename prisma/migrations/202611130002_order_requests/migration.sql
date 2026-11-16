-- Apply only after the schema-parity migration has been reviewed/applied.
-- Identity and its response commit atomically with the order transaction.
BEGIN;
CREATE TABLE "order_requests" (
    "order_request_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "order_id" INTEGER,
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_requests_pkey" PRIMARY KEY ("order_request_id")
);

CREATE UNIQUE INDEX "order_requests_order_id_key" ON "order_requests"("order_id");
CREATE UNIQUE INDEX "order_requests_user_id_key_key" ON "order_requests"("user_id", "key");
CREATE INDEX "order_requests_created_at_idx" ON "order_requests"("created_at");

ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_requests" ADD CONSTRAINT "order_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
