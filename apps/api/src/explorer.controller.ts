import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { randomUUID } from 'crypto';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

type Space = 'COMPANY' | 'PERSONAL';

class FolderDto {
  @IsString() name!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsIn(['COMPANY', 'PERSONAL']) space?: Space;
  @IsOptional() @IsIn(['COMPANY', 'PRIVATE', 'RESTRICTED']) visibility?: 'COMPANY' | 'PRIVATE' | 'RESTRICTED';
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) groupIds?: string[];
}
class RenameDto { @IsString() name!: string; }
class FolderAccessDto {
  @IsIn(['COMPANY', 'PRIVATE', 'RESTRICTED']) visibility!: 'COMPANY' | 'PRIVATE' | 'RESTRICTED';
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) groupIds?: string[];
}
class PrepareUploadDto {
  @IsString() folderId!: string; @IsString() name!: string; @IsString() mimeType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
}
class CompletePartDto { @IsInt() @Min(1) partNumber!: number; @IsString() etag!: string; }
class CompleteUploadDto { @IsString() documentId!: string; @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CompletePartDto) parts?: CompletePartDto[]; }
class PartUrlDto { @IsString() documentId!: string; @IsInt() @Min(1) partNumber!: number; }

@Controller('explorer')
@UseGuards(JwtGuard)
export class ExplorerController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any): string {
    if (!req.user.tenantId) throw new BadRequestException('Organisation requise');
    return req.user.tenantId;
  }
  private canWrite(req: any): void {
    if (req.user.role === 'VIEWER') throw new ForbiddenException('Action interdite');
  }
  private normalizeSpace(value?: string): Space {
    return value === 'PERSONAL' ? 'PERSONAL' : 'COMPANY';
  }
  private accessWhere(req: any, space: Space): any {
    if (space === 'COMPANY' && req.user.role === 'TENANT_ADMIN') return { space: 'COMPANY' };
    return {
      space,
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
  }
  private async folderOrThrow(req: any, id: string) {
    const tenantId = this.tenant(req);
    const probe = await this.db.folder.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true, space: true } });
    if (!probe) throw new NotFoundException('Dossier introuvable ou accès non autorisé');
    const folder = await this.db.folder.findFirst({
      where: { id, tenantId, deletedAt: null, ...this.accessWhere(req, probe.space as Space) },
    });
    if (!folder) throw new NotFoundException('Dossier introuvable ou accès non autorisé');
    return folder;
  }

  @Get()
  async list(@Req() req: any, @Query('folderId') folderId?: string, @Query('sort') sort = 'name', @Query('direction') direction = 'asc', @Query('space') requestedSpace = 'COMPANY') {
    const tenantId = this.tenant(req);
    const space = this.normalizeSpace(requestedSpace);
    const allowed = ['name', 'sizeBytes', 'createdAt', 'updatedAt', 'mimeType'];
    if (!allowed.includes(sort)) sort = 'name';
    const dir = direction === 'desc' ? 'desc' : 'asc';
    let currentFolder: any = null;
    let breadcrumbs: Array<{ id: string; name: string }> = [];
    if (folderId) {
      currentFolder = await this.folderOrThrow(req, folderId);
      if (currentFolder.space !== space) throw new BadRequestException('Ce dossier appartient à un autre espace');
      const trail: Array<{ id: string; name: string }> = [];
      let cursor: any = currentFolder;
      while (cursor) {
        trail.unshift({ id: cursor.id, name: cursor.name });
        cursor = cursor.parentId ? await this.db.folder.findFirst({ where: { id: cursor.parentId, tenantId, deletedAt: null, space } }) : null;
      }
      breadcrumbs = trail;
    }
    const [folders, documents, tenant] = await Promise.all([
      this.db.folder.findMany({
        where: { tenantId, parentId: folderId || null, deletedAt: null, ...this.accessWhere(req, space) },
        orderBy: { name: dir as any },
        include: { createdBy: { select: { name: true } } },
      }),
      folderId ? this.db.document.findMany({
        where: { tenantId, folderId, deletedAt: null, status: 'ACTIVE' },
        orderBy: { [sort]: dir } as any,
        include: { createdBy: { select: { name: true } } },
      }) : [],
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    ]);
    const [usage, pending] = await Promise.all([
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'PENDING_UPLOAD' } }),
    ]);
    return { space, currentFolder, breadcrumbs, folders, documents, quota: { usedBytes: String(usage._sum.sizeBytes || 0), pendingBytes: String(pending._sum.sizeBytes || 0), limitBytes: String(tenant.storageQuotaBytes) } };
  }

  @Post('folders')
  async createFolder(@Req() req: any, @Body() dto: FolderDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req); const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nom du dossier requis');
    const parent = dto.parentId ? await this.folderOrThrow(req, dto.parentId) : null;
    const space = parent ? parent.space as Space : this.normalizeSpace(dto.space);
    const visibility = dto.visibility || (space === 'PERSONAL' ? 'PRIVATE' : 'COMPANY');
    const userIds = [...new Set(dto.userIds || [])]; const groupIds = [...new Set(dto.groupIds || [])];
    if (visibility === 'RESTRICTED' && !userIds.length && !groupIds.length) throw new BadRequestException('Sélectionnez au moins une personne ou un groupe');
    if (userIds.length) {
      const count = await this.db.user.count({ where: { id: { in: userIds }, tenantId, status: 'ACTIVE' } });
      if (count !== userIds.length) throw new BadRequestException('Un utilisateur sélectionné est invalide');
    }
    if (groupIds.length) {
      const count = await this.db.group.count({ where: { id: { in: groupIds }, tenantId } });
      if (count !== groupIds.length) throw new BadRequestException('Un groupe sélectionné est invalide');
    }
    return this.db.folder.create({
      data: {
        tenantId, parentId: dto.parentId || null, name, createdById: req.user.sub, visibility, space,
        userAccesses: visibility === 'RESTRICTED' ? { create: userIds.filter(id => id !== req.user.sub).map(userId => ({ userId })) } : undefined,
        groupAccesses: visibility === 'RESTRICTED' ? { create: groupIds.map(groupId => ({ groupId })) } : undefined,
      },
      include: { createdBy: { select: { name: true } } },
    });
  }

  @Get('folders/:id/access')
  async getFolderAccess(@Req() req: any, @Param('id') id: string) {
    this.canWrite(req);
    const folder = await this.folderOrThrow(req, id);
    if (folder.space === 'PERSONAL' && folder.createdById !== req.user.sub) {
      throw new ForbiddenException('Seul le propriétaire peut gérer le partage de ce dossier personnel');
    }
    if (folder.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && folder.createdById !== req.user.sub) {
      throw new ForbiddenException('Seul le créateur ou un administrateur peut gérer les accès de ce dossier');
    }
    const full = await this.db.folder.findUniqueOrThrow({
      where: { id },
      select: {
        id: true, visibility: true, space: true,
        userAccesses: { select: { userId: true } },
        groupAccesses: { select: { groupId: true } },
      },
    });
    return {
      space: full.space,
      visibility: full.visibility,
      userIds: full.userAccesses.map((access) => access.userId),
      groupIds: full.groupAccesses.map((access) => access.groupId),
    };
  }

  @Patch('folders/:id/access')
  async updateFolderAccess(@Req() req: any, @Param('id') id: string, @Body() dto: FolderAccessDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const folder = await this.folderOrThrow(req, id);
    if (folder.space === 'PERSONAL' && folder.createdById !== req.user.sub) {
      throw new ForbiddenException('Seul le propriétaire peut gérer le partage de ce dossier personnel');
    }
    if (folder.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && folder.createdById !== req.user.sub) {
      throw new ForbiddenException('Seul le créateur ou un administrateur peut gérer les accès de ce dossier');
    }
    const userIds = [...new Set(dto.userIds || [])].filter((userId) => userId !== req.user.sub);
    const groupIds = [...new Set(dto.groupIds || [])];
    if (dto.visibility === 'RESTRICTED' && !userIds.length && !groupIds.length) {
      throw new BadRequestException('Sélectionnez au moins une personne ou un groupe');
    }
    if (userIds.length) {
      const count = await this.db.user.count({ where: { id: { in: userIds }, tenantId, status: 'ACTIVE' } });
      if (count !== userIds.length) throw new BadRequestException('Un utilisateur sélectionné est invalide');
    }
    if (groupIds.length) {
      const count = await this.db.group.count({ where: { id: { in: groupIds }, tenantId } });
      if (count !== groupIds.length) throw new BadRequestException('Un groupe sélectionné est invalide');
    }
    await this.db.$transaction(async (tx) => {
      await tx.folderUserAccess.deleteMany({ where: { folderId: id } });
      await tx.folderGroupAccess.deleteMany({ where: { folderId: id } });
      await tx.folder.update({ where: { id }, data: { visibility: dto.visibility } });
      if (dto.visibility === 'RESTRICTED' && userIds.length) {
        await tx.folderUserAccess.createMany({ data: userIds.map((userId) => ({ folderId: id, userId })), skipDuplicates: true });
      }
      if (dto.visibility === 'RESTRICTED' && groupIds.length) {
        await tx.folderGroupAccess.createMany({ data: groupIds.map((groupId) => ({ folderId: id, groupId })), skipDuplicates: true });
      }
    });
    return { success: true };
  }

  @Patch('folders/:id')
  async renameFolder(@Req() req: any, @Param('id') id: string, @Body() dto: RenameDto) {
    this.canWrite(req); const folder = await this.folderOrThrow(req, id);
    if (folder.space === 'PERSONAL' && folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut renommer ce dossier personnel');
    if (folder.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le créateur ou un administrateur peut renommer ce dossier');
    return this.db.folder.update({ where: { id }, data: { name: dto.name.trim() } });
  }

  @Delete('folders/:id')
  async trashFolder(@Req() req: any, @Param('id') id: string) {
    this.canWrite(req); const tenantId = this.tenant(req);
    const folder = await this.folderOrThrow(req, id);
    if (folder.space === 'PERSONAL' && folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut supprimer ce dossier personnel');
    if (folder.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Action réservée à l’administrateur dans l’espace entreprise');
    const now = new Date();
    await this.db.$transaction([
      this.db.folder.updateMany({ where: { id, tenantId }, data: { deletedAt: now } }),
      this.db.document.updateMany({ where: { folderId: id, tenantId, deletedAt: null }, data: { deletedAt: now, status: 'TRASHED' } }),
    ]);
    return { success: true };
  }

  private async cleanupPending(tenantId: string, olderThanMinutes = 60) {
    const limit = new Date(Date.now() - olderThanMinutes * 60_000);
    const abandoned = await this.db.document.findMany({
      where: { tenantId, status: 'PENDING_UPLOAD', createdAt: { lt: limit } },
      select: { id: true, storageKey: true, metadata: true },
    });
    for (const doc of abandoned) {
      const meta = (doc.metadata || {}) as any;
      if (meta.uploadId) await this.storage.abortMultipart(doc.storageKey, meta.uploadId).catch(() => undefined);
      await this.storage.delete(doc.storageKey).catch(() => undefined);
    }
    if (abandoned.length) await this.db.document.deleteMany({ where: { id: { in: abandoned.map((d) => d.id) } } });
  }

  @Post('uploads/prepare')
  async prepare(@Req() req: any, @Body() dto: PrepareUploadDto) {
    this.canWrite(req); const tenantId = this.tenant(req); await this.folderOrThrow(req, dto.folderId);
    await this.cleanupPending(tenantId);
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (BigInt(dto.sizeBytes) > tenant.maxFileSizeBytes) throw new BadRequestException('Fichier trop volumineux');
    const used = (await this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: { in: ['ACTIVE', 'PENDING_UPLOAD'] } } }))._sum.sizeBytes || 0n;
    if (used + BigInt(dto.sizeBytes) > tenant.storageQuotaBytes) throw new BadRequestException('Quota de stockage dépassé');
    const id = randomUUID(); const safe = dto.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const key = `tenants/${tenantId}/documents/${id}/versions/1/${safe}`;
    const multipartThreshold = 64 * 1024 * 1024;
    const partSize = 64 * 1024 * 1024;
    const multipart = dto.sizeBytes >= multipartThreshold;
    let uploadId: string | undefined;
    if (multipart) uploadId = await this.storage.createMultipart(key, dto.mimeType || 'application/octet-stream');
    const doc = await this.db.document.create({ data: { id, tenantId, folderId: dto.folderId, technicalNumber: `COF-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`, name: dto.name, extension: dto.name.includes('.') ? dto.name.split('.').pop()?.toLowerCase() : null, mimeType: dto.mimeType || 'application/octet-stream', sizeBytes: BigInt(dto.sizeBytes), storageKey: key, createdById: req.user.sub, metadata: multipart ? ({ uploadId, multipart: true, partSize } as any) : ({ multipart: false } as any) } });
    if (multipart) {
      const partCount = Math.ceil(dto.sizeBytes / partSize);
      const partUrls = await Promise.all(
        Array.from({ length: partCount }, (_, index) =>
          this.storage.multipartPartUrl(key, uploadId!, index + 1),
        ),
      );
      return {
        documentId: doc.id,
        mode: 'multipart',
        partSize,
        partCount,
        partUrls,
        recommendedConcurrency: 6,
        expiresIn: Number(process.env.S3_PRESIGNED_TTL_SECONDS || 3600),
      };
    }
    return { documentId: doc.id, mode: 'single', uploadUrl: await this.storage.uploadUrl(key, doc.mimeType), expiresIn: Number(process.env.S3_PRESIGNED_TTL_SECONDS || 3600) };
  }

  @Post('uploads/part-url')
  async partUrl(@Req() req: any, @Body() dto: PartUrlDto) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id: dto.documentId, tenantId, status: 'PENDING_UPLOAD' } });
    if (!doc) throw new NotFoundException('Import introuvable');
    const meta = (doc.metadata || {}) as any;
    if (!meta.uploadId) throw new BadRequestException('Import multipart non initialisé');
    const maxParts = Math.ceil(Number(doc.sizeBytes) / Number(meta.partSize || 33554432));
    if (dto.partNumber > maxParts) throw new BadRequestException('Numéro de partie invalide');
    return { url: await this.storage.multipartPartUrl(doc.storageKey, meta.uploadId, dto.partNumber) };
  }

  @Post('uploads/complete')
  async complete(@Req() req: any, @Body() dto: CompleteUploadDto) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id: dto.documentId, tenantId, status: 'PENDING_UPLOAD' } });
    if (!doc) throw new NotFoundException('Import introuvable');
    await this.folderOrThrow(req, doc.folderId);
    const meta = (doc.metadata || {}) as any;
    if (meta.uploadId) {
      if (!dto.parts?.length) throw new BadRequestException('Liste des parties manquante');
      await this.storage.completeMultipart(doc.storageKey, meta.uploadId, dto.parts);
    }
    await this.storage.head(doc.storageKey);
    return this.db.document.update({ where: { id: doc.id }, data: { status: 'ACTIVE', metadata: ({ multipart: Boolean(meta.uploadId), completedAt: new Date().toISOString() } as any) } });
  }

  @Delete('uploads/:id')
  async cancelUpload(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id, tenantId, status: 'PENDING_UPLOAD' } });
    if (!doc) return { success: true };
    const meta = (doc.metadata || {}) as any;
    if (meta.uploadId) await this.storage.abortMultipart(doc.storageKey, meta.uploadId).catch(() => undefined);
    await this.storage.delete(doc.storageKey).catch(() => undefined);
    await this.db.document.delete({ where: { id: doc.id } });
    return { success: true };
  }

  @Get('documents/:id/url')
  async url(@Req() req: any, @Param('id') id: string, @Query('mode') mode = 'download') {
    const doc = await this.db.document.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: null, status: 'ACTIVE' } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.folderOrThrow(req, doc.folderId);
    return { url: await this.storage.downloadUrl(doc.storageKey, mode === 'preview' ? 'inline' : 'attachment') };
  }

  @Patch('documents/:id')
  async renameDocument(@Req() req: any, @Param('id') id: string, @Body() dto: RenameDto) {
    this.canWrite(req);
    const doc = await this.db.document.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: null, status: 'ACTIVE' } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.folderOrThrow(req, doc.folderId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nom du document requis');
    return this.db.document.update({ where: { id }, data: { name, extension: name.includes('.') ? name.split('.').pop()?.toLowerCase() : null } });
  }

  @Delete('documents/:id')
  async trashDocument(@Req() req: any, @Param('id') id: string) {
    this.canWrite(req);
    const doc = await this.db.document.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: null } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.folderOrThrow(req, doc.folderId);
    await this.db.document.update({ where: { id }, data: { deletedAt: new Date(), status: 'TRASHED' } });
    return { success: true };
  }
}
