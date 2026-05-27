-- CreateTable: WorkerSession for OTP-based worker self-service authentication
-- Purpose: Store 6-digit OTP codes with expiry for worker signin flow
-- Relations: workerId -> Worker, agencyId -> Agency (for multi-tenant isolation)

CREATE TABLE "worker_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_sessions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers" ("id") ON DELETE CASCADE,
    CONSTRAINT "worker_sessions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies" ("id") ON DELETE CASCADE
);

-- Index for fast OTP lookup by worker + agency
CREATE UNIQUE INDEX "worker_sessions_workerId_otp_key" ON "worker_sessions"("workerId", "otp");

-- Index for cleanup of expired sessions
CREATE INDEX "worker_sessions_expiresAt_idx" ON "worker_sessions"("expiresAt");
