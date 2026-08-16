-- MFA obligatoire Coffria : Authenticator, email, codes de récupération et appareils de confiance.
CREATE TYPE "MfaMethod" AS ENUM ('TOTP', 'EMAIL');

ALTER TABLE "Tenant"
  ADD COLUMN "mfaAllowTotp" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "mfaAllowEmail" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "User"
  ADD COLUMN "mfaMethod" "MfaMethod",
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaRecoveryCodes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "mfaConfiguredAt" TIMESTAMP(3);

CREATE TABLE "MfaEmailChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaEmailChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MfaEmailChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TrustedDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MfaEmailChallenge_userId_purpose_createdAt_idx" ON "MfaEmailChallenge"("userId", "purpose", "createdAt");
CREATE UNIQUE INDEX "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");
CREATE INDEX "TrustedDevice_userId_expiresAt_idx" ON "TrustedDevice"("userId", "expiresAt");
