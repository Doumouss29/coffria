CREATE TABLE IF NOT EXISTS "TenantFeature" (
  "tenantId" TEXT NOT NULL PRIMARY KEY,
  "signatureEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "TenantFeature" ("tenantId", "signatureEnabled")
SELECT "id", TRUE FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;
