CREATE TABLE IF NOT EXISTS "TenantBranding" (
  "tenantId" TEXT NOT NULL PRIMARY KEY,
  "isEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "appName" TEXT,
  "customDomain" TEXT,
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "primaryColor" TEXT,
  "accentColor" TEXT,
  "backgroundColor" TEXT,
  "loginTitle" TEXT,
  "loginSubtitle" TEXT,
  "poweredByCoffria" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantBranding_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_customDomain_key"
ON "TenantBranding"("customDomain");
