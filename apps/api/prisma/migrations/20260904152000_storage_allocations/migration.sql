ALTER TABLE "Tenant" ADD COLUMN "companyStorageQuotaBytes" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "personalStorageQuotaBytes" BIGINT NOT NULL DEFAULT 0;

UPDATE "Tenant"
SET "companyStorageQuotaBytes" = "storageQuotaBytes";
