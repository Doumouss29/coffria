CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN','TENANT_ADMIN','EDITOR','VIEWER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE','INVITED','SUSPENDED');
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD','ACTIVE','QUARANTINED','TRASHED');

CREATE TABLE "Tenant" (
 "id" TEXT PRIMARY KEY,
 "name" TEXT NOT NULL,
 "slug" TEXT NOT NULL UNIQUE,
 "storageQuotaBytes" BIGINT NOT NULL DEFAULT 107374182400,
 "maxUsers" INTEGER NOT NULL DEFAULT 10,
 "maxFileSizeBytes" BIGINT NOT NULL DEFAULT 5368709120,
 "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "User" (
 "id" TEXT PRIMARY KEY,
 "tenantId" TEXT,
 "name" TEXT NOT NULL,
 "email" TEXT NOT NULL UNIQUE,
 "passwordHash" TEXT NOT NULL,
 "role" "PlatformRole" NOT NULL,
 "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
 "mfaEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Folder" (
 "id" TEXT PRIMARY KEY,
 "tenantId" TEXT NOT NULL,
 "parentId" TEXT,
 "name" TEXT NOT NULL,
 "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "deletedAt" TIMESTAMP(3),
 CONSTRAINT "Folder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Folder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Document" (
 "id" TEXT PRIMARY KEY,
 "tenantId" TEXT NOT NULL,
 "folderId" TEXT NOT NULL,
 "technicalNumber" TEXT NOT NULL UNIQUE,
 "name" TEXT NOT NULL,
 "extension" TEXT,
 "mimeType" TEXT NOT NULL,
 "sizeBytes" BIGINT NOT NULL,
 "storageKey" TEXT NOT NULL UNIQUE,
 "checksumSha256" TEXT,
 "version" INTEGER NOT NULL DEFAULT 1,
 "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
 "metadata" JSONB NOT NULL DEFAULT '{}',
 "extractedText" TEXT,
 "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 "deletedAt" TIMESTAMP(3),
 CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Invitation" (
 "id" TEXT PRIMARY KEY,
 "tenantId" TEXT NOT NULL,
 "email" TEXT NOT NULL,
 "role" "PlatformRole" NOT NULL,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "AuditLog" (
 "id" TEXT PRIMARY KEY,
 "tenantId" TEXT,
 "userId" TEXT,
 "action" TEXT NOT NULL,
 "entityType" TEXT NOT NULL,
 "entityId" TEXT,
 "ipAddress" TEXT,
 "userAgent" TEXT,
 "details" JSONB NOT NULL DEFAULT '{}',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Folder_tenantId_parentId_name_key" ON "Folder"("tenantId","parentId","name");
CREATE INDEX "Folder_tenantId_parentId_deletedAt_idx" ON "Folder"("tenantId","parentId","deletedAt");
CREATE INDEX "Document_tenantId_folderId_status_deletedAt_idx" ON "Document"("tenantId","folderId","status","deletedAt");
CREATE INDEX "Document_tenantId_name_idx" ON "Document"("tenantId","name");
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId","createdAt");
