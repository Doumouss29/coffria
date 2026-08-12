CREATE TYPE "FolderVisibility" AS ENUM ('COMPANY', 'PRIVATE', 'RESTRICTED');

ALTER TABLE "Folder" ADD COLUMN "visibility" "FolderVisibility" NOT NULL DEFAULT 'COMPANY';

CREATE TABLE "Group" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Group_tenantId_name_key" ON "Group"("tenantId", "name");
CREATE INDEX "Group_tenantId_idx" ON "Group"("tenantId");
ALTER TABLE "Group" ADD CONSTRAINT "Group_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GroupMember" ("groupId" TEXT NOT NULL, "userId" TEXT NOT NULL, CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId"));
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FolderUserAccess" ("folderId" TEXT NOT NULL, "userId" TEXT NOT NULL, CONSTRAINT "FolderUserAccess_pkey" PRIMARY KEY ("folderId","userId"));
CREATE INDEX "FolderUserAccess_userId_idx" ON "FolderUserAccess"("userId");
ALTER TABLE "FolderUserAccess" ADD CONSTRAINT "FolderUserAccess_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderUserAccess" ADD CONSTRAINT "FolderUserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FolderGroupAccess" ("folderId" TEXT NOT NULL, "groupId" TEXT NOT NULL, CONSTRAINT "FolderGroupAccess_pkey" PRIMARY KEY ("folderId","groupId"));
CREATE INDEX "FolderGroupAccess_groupId_idx" ON "FolderGroupAccess"("groupId");
ALTER TABLE "FolderGroupAccess" ADD CONSTRAINT "FolderGroupAccess_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FolderGroupAccess" ADD CONSTRAINT "FolderGroupAccess_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
