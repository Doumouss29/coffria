ALTER TABLE "Tenant" ADD COLUMN "signatureEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "Tenant" ADD COLUMN "signatureUsageLimit" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "signatureUsageUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SignatureRequest" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "SignatureRequest_tenantId_deletedAt_idx" ON "SignatureRequest"("tenantId", "deletedAt");
