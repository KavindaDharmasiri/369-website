-- Align additive recommendation migration with Prisma @updatedAt (no DB default) so structural coverage matches rendered schema.
BEGIN;

CREATE TABLE "user_preferences" (
    "user_preference_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "personalization_enabled" BOOLEAN NOT NULL DEFAULT true,
    "preferred_sizes" TEXT,
    "preferred_colors" TEXT,
    "favorite_categories" TEXT,
    "preferred_styles" TEXT,
    "price_min" DECIMAL(10,2),
    "price_max" DECIMAL(10,2),
    "consent_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_preference_id")
);

CREATE TABLE "engagement_events" (
    "engagement_event_id" SERIAL NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" INTEGER,
    "event_type" VARCHAR(64) NOT NULL,
    "page_path" VARCHAR(500),
    "page_type" VARCHAR(64),
    "product_id" INTEGER,
    "category_id" INTEGER,
    "search_query" VARCHAR(200),
    "active_ms" INTEGER NOT NULL DEFAULT 0,
    "scroll_depth" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_events_pkey" PRIMARY KEY ("engagement_event_id")
);

CREATE TABLE "recommendation_rules" (
    "recommendation_rule_id" SERIAL NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "trigger_type" VARCHAR(64) NOT NULL,
    "conditions" JSONB,
    "action_type" VARCHAR(64) NOT NULL,
    "action_config" JSONB,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 300,
    "max_per_session" INTEGER NOT NULL DEFAULT 2,
    "page_scopes" JSONB,
    "suppress_on_pages" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("recommendation_rule_id")
);

CREATE TABLE "recommendation_logs" (
    "recommendation_log_id" SERIAL NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" INTEGER,
    "rule_key" VARCHAR(80) NOT NULL,
    "action_type" VARCHAR(64) NOT NULL,
    "page_path" VARCHAR(500),
    "context" JSONB,
    "product_ids" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'shown',
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_logs_pkey" PRIMARY KEY ("recommendation_log_id")
);

CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");
CREATE INDEX "user_preferences_personalization_enabled_idx" ON "user_preferences"("personalization_enabled");

CREATE INDEX "engagement_events_user_id_created_at_idx" ON "engagement_events"("user_id", "created_at");
CREATE INDEX "engagement_events_session_id_created_at_idx" ON "engagement_events"("session_id", "created_at");
CREATE INDEX "engagement_events_event_type_created_at_idx" ON "engagement_events"("event_type", "created_at");
CREATE INDEX "engagement_events_product_id_created_at_idx" ON "engagement_events"("product_id", "created_at");

CREATE UNIQUE INDEX "recommendation_rules_key_key" ON "recommendation_rules"("key");
CREATE INDEX "recommendation_rules_enabled_priority_idx" ON "recommendation_rules"("enabled", "priority");
CREATE INDEX "recommendation_rules_trigger_type_idx" ON "recommendation_rules"("trigger_type");

CREATE INDEX "recommendation_logs_session_id_created_at_idx" ON "recommendation_logs"("session_id", "created_at");
CREATE INDEX "recommendation_logs_user_id_created_at_idx" ON "recommendation_logs"("user_id", "created_at");
CREATE INDEX "recommendation_logs_rule_key_created_at_idx" ON "recommendation_logs"("rule_key", "created_at");
CREATE INDEX "recommendation_logs_status_created_at_idx" ON "recommendation_logs"("status", "created_at");

ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recommendation_logs" ADD CONSTRAINT "recommendation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;