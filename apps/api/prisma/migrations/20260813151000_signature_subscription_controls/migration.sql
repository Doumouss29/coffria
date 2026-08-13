ALTER TABLE "Tenant" ADD COLUMN "signatureEnabled" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "Tenant" ADD COLUMN "signatureUsageLimit" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "signatureUsageUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SignatureRequest" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "SignatureRequest_tenantId_deletedAt_idx" ON "SignatureRequest"("tenantId", "deletedAt");

CREATE OR REPLACE FUNCTION coffria_signature_entitlement()
RETURNS TRIGGER AS $$
DECLARE
  feature_enabled BOOLEAN;
  usage_limit INTEGER;
  usage_used INTEGER;
BEGIN
  SELECT "signatureEnabled", "signatureUsageLimit", "signatureUsageUsed"
    INTO feature_enabled, usage_limit, usage_used
  FROM "Tenant"
  WHERE "id" = NEW."tenantId"
  FOR UPDATE;

  IF feature_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'MODULE_SIGNATURE_DISABLED';
  END IF;

  IF usage_limit IS NOT NULL AND usage_used >= usage_limit THEN
    RAISE EXCEPTION 'SIGNATURE_QUOTA_REACHED';
  END IF;

  UPDATE "Tenant"
  SET "signatureUsageUsed" = "signatureUsageUsed" + 1
  WHERE "id" = NEW."tenantId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SignatureRequest_entitlement_check"
BEFORE INSERT ON "SignatureRequest"
FOR EACH ROW
EXECUTE FUNCTION coffria_signature_entitlement();
