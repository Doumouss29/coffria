CREATE TYPE "SignatureRequestStatus" AS ENUM ('DRAFT','PENDING','PARTIALLY_SIGNED','COMPLETED','REFUSED','EXPIRED','CANCELLED');
CREATE TYPE "SignatureRecipientStatus" AS ENUM ('PENDING','VIEWED','SIGNED','REFUSED');

CREATE TABLE "ArchiveChunk" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "page" INTEGER,
  "position" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchiveChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ArchiveChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ArchiveChunk_tenantId_documentId_idx" ON "ArchiveChunk"("tenantId","documentId");
CREATE INDEX "ArchiveChunk_tenantId_position_idx" ON "ArchiveChunk"("tenantId","position");

CREATE TABLE "SignatureRequest" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "finalDocumentId" TEXT,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "status" "SignatureRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "currentStorageKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SignatureRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignatureRequest_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SignatureRequest_finalDocumentId_fkey" FOREIGN KEY ("finalDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SignatureRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SignatureRequest_tenantId_status_createdAt_idx" ON "SignatureRequest"("tenantId","status","createdAt");

CREATE TABLE "SignatureRecipient" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "status" "SignatureRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "viewedAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "refusedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "signatureText" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SignatureRecipient_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SignatureRecipient_requestId_order_key" ON "SignatureRecipient"("requestId","order");
CREATE INDEX "SignatureRecipient_requestId_status_idx" ON "SignatureRecipient"("requestId","status");
