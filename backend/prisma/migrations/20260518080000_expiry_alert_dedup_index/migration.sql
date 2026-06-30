-- AddColumn: alertDateOnly to ExpiryAlert for race-safe dedup
-- Purpose: Store UTC-midnight version of alertDate for use in unique constraint
-- This ensures at most one alert per (document, daysUntilExpiry, day) pair

ALTER TABLE "expiry_alerts" ADD COLUMN "alertDateOnly" DATE NOT NULL DEFAULT CURRENT_DATE;

-- Backfill alertDateOnly from alertDate for existing rows (normalize to UTC midnight)
UPDATE "expiry_alerts" SET "alertDateOnly" = CAST("alertDate" AT TIME ZONE 'UTC' AS DATE);

-- Create unique index: prevent concurrent cron jobs from creating duplicates
CREATE UNIQUE INDEX "expiry_alerts_dedup_idx" ON "expiry_alerts"("complianceDocumentId", "daysUntilExpiry", "alertDateOnly");

-- Comment for future reference
COMMENT ON INDEX "expiry_alerts_dedup_idx" IS 'Race-safe dedup: exactly one alert per (doc, days, date) tuple. Prevents duplicate email notifications if cron runs concurrently.';
