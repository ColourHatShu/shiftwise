-- AddColumn: encryptionAlgorithm to ComplianceDocument
-- Purpose: Track which encryption algorithm was used for each document
-- Values: 'aes-256-cbc' (legacy/existing) or 'aes-256-gcm' (new authenticated cipher)
-- Default: 'aes-256-cbc' backfills all existing documents as CBC (correct, since they were encrypted with CBC)

ALTER TABLE "compliance_documents" ADD COLUMN "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'aes-256-cbc';
