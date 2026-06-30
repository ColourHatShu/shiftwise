-- AlterTable
ALTER TABLE "shift_assignments"
ADD COLUMN "complianceSnapshot" JSONB,
ADD COLUMN "workerConfirmation" VARCHAR(255) NOT NULL DEFAULT 'pending',
ADD COLUMN "workerNote" VARCHAR(200);
