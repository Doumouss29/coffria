CREATE TYPE "FolderSpace" AS ENUM ('COMPANY', 'PERSONAL');

ALTER TABLE "Folder"
ADD COLUMN "space" "FolderSpace" NOT NULL DEFAULT 'COMPANY';

DROP INDEX IF EXISTS "Folder_tenantId_parentId_name_key";

CREATE INDEX "Folder_tenantId_space_parentId_deletedAt_idx"
ON "Folder"("tenantId", "space", "parentId", "deletedAt");

CREATE UNIQUE INDEX "Folder_tenantId_space_parentId_name_key"
ON "Folder"("tenantId", "space", "parentId", "name");
