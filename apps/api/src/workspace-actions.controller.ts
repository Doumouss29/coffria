import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { randomUUID } from 'crypto';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

type Space = 'COMPANY' | 'PERSONAL';
type Kind = 'document' | 'folder';

class TransferDto {
  @IsArray() @IsString({ each: true }) documentIds!: string[];
  @IsArray() @IsString({ each: true }) folderIds!: string[];
  @IsOptional() @IsString() targetFolderId?: string;
  @IsIn(['COMPANY', 'PERSONAL']) sourceSpace!: Space;
  @IsIn(['COMPANY', 'PERSONAL']) targetSpace!: Space;
}

class RenameDto {
  @IsString() name!: string;
}

@Controller('workspace-actions')
@UseGuards(JwtGuard)
export class WorkspaceActionsController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any): string {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }

  private canWrite(req: any) {
    if (req.user.role === 'VIEWER') throw new ForbiddenException('Action interdite en consultation');
  }

  private ids(dto: TransferDto) {
    return {
      documentIds: [...new Set(dto.documentIds || [])],
      folderIds: [...new Set(dto.folderIds || [])],
    };
  }

  private companyAccessWhere(req: any): any {
    if (req.user.role === 'TENANT_ADMIN') return { space: 'COMPANY' };
    return {
      space: 'COMPANY',
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
  }

  private accessWhere(req: any, space: Space): any {
    if (space === 'PERSONAL') return { space: 'PERSONAL', createdById: req.user.sub };
    return this.companyAccessWhere(req);
  }

  private async folderAccessible(req: any, id: string, space?: Space) {
    const tenantId = this.tenant(req);
    const folder = await this.db.folder.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        ...(space ? this.accessWhere(req, space) : {}),
      },
      include: {
        userAccesses: true,
        groupAccesses: true,
      },
    });
    if (!folder) throw new NotFoundException('Dossier introuvable ou non autorisé');
    if (folder.space === 'PERSONAL' && folder.createdById !== req.user.sub) {
      throw new ForbiddenException('Espace personnel non autorisé');
    }
    return folder;
  }

  private async documentAccessible(req: any, id: string) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({
      where: { id, tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { folder: true, createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (doc.folder.space === 'PERSONAL') {
      if (doc.folder.createdById !== req.user.sub) throw new ForbiddenException('Document personnel non autorisé');
    } else {
      const allowed = await this.db.folder.count({ where: { id: doc.folderId, tenantId, deletedAt: null, ...this.companyAccessWhere(req) } });
      if (!allowed) throw new ForbiddenException('Document non autorisé');
    }
    return doc;
  }

  private async descendants(tenantId: string, rootIds: string[]) {
    const all = new Set(rootIds);
    let frontier = [...rootIds];
    while (frontier.length) {
      const children = await this.db.folder.findMany({
        where: { tenantId, parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((x) => x.id).filter((id) => !all.has(id));
      frontier.forEach((id) => all.add(id));
    }
    return [...all];
  }

  private async assertSelection(req: any, documentIds: string[], folderIds: string[], sourceSpace: Space) {
    const tenantId = this.tenant(req);
    if (folderIds.length) {
      const folders = await this.db.folder.findMany({
        where: { tenantId, id: { in: folderIds }, deletedAt: null, ...this.accessWhere(req, sourceSpace) },
        select: { id: true, createdById: true, space: true },
      });
      if (folders.length !== folderIds.length) throw new ForbiddenException('Un dossier sélectionné est introuvable ou non autorisé');
      for (const folder of folders) {
        if (folder.space !== sourceSpace) throw new BadRequestException('Les dossiers sélectionnés ne sont pas dans l’espace source');
        if (sourceSpace === 'PERSONAL' && folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut transférer un dossier personnel');
        if (sourceSpace === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && folder.createdById !== req.user.sub) {
          throw new ForbiddenException('Seul le créateur ou un administrateur peut transférer ce dossier');
        }
      }
    }

    if (documentIds.length) {
      const docs = await this.db.document.findMany({
        where: { tenantId, id: { in: documentIds }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, folder: { select: { id: true, space: true, createdById: true } } },
      });
      if (docs.length !== documentIds.length) throw new ForbiddenException('Un document sélectionné est introuvable ou non autorisé');
      for (const doc of docs) {
        if (doc.folder.space !== sourceSpace) throw new BadRequestException('Les documents sélectionnés ne sont pas dans l’espace source');
        if (sourceSpace === 'PERSONAL') {
          if (doc.folder.createdById !== req.user.sub) throw new ForbiddenException('Document personnel non autorisé');
        } else {
          const allowed = await this.db.folder.count({ where: { id: doc.folder.id, tenantId, deletedAt: null, ...this.companyAccessWhere(req) } });
          if (!allowed) throw new ForbiddenException('Document non autorisé');
        }
      }
    }
  }

  private async selectedDocuments(tenantId: string, documentIds: string[], folderIds: string[]) {
    const tree = await this.descendants(tenantId, folderIds);
    const docs = await this.db.document.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        OR: [{ id: { in: documentIds } }, { folderId: { in: tree } }],
      },
      select: { id: true, sizeBytes: true },
    });
    return { tree, docs };
  }

  private async quotaState(req: any, space: Space) {
    const tenantId = this.tenant(req);
    const [tenant, user] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      space === 'PERSONAL'
        ? this.db.user.findUniqueOrThrow({ where: { id: req.user.sub }, select: { personalStorageQuotaBytes: true } })
        : Promise.resolve(null),
    ]);
    const folderFilter = space === 'PERSONAL'
      ? { space: 'PERSONAL' as const, createdById: req.user.sub }
      : { space: 'COMPANY' as const };
    const [usage, pending] = await Promise.all([
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'ACTIVE', folder: folderFilter } }),
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'PENDING_UPLOAD', folder: folderFilter } }),
    ]);
    return {
      used: usage._sum.sizeBytes || 0n,
      pending: pending._sum.sizeBytes || 0n,
      limit: space === 'PERSONAL' ? (user?.personalStorageQuotaBytes || 0n) : tenant.companyStorageQuotaBytes,
    };
  }

  private async ensureQuota(req: any, targetSpace: Space, bytes: bigint) {
    if (bytes <= 0n) return;
    const quota = await this.quotaState(req, targetSpace);
    if (quota.limit <= 0n || quota.used + quota.pending + bytes > quota.limit) {
      throw new BadRequestException(targetSpace === 'PERSONAL' ? 'Espace personnel insuffisant pour cette opération' : 'Espace entreprise insuffisant pour cette opération');
    }
  }

  private async uniqueFolderName(tenantId: string, space: Space, parentId: string | null, sourceName: string) {
    let candidate = `${sourceName} - copie`;
    let index = 2;
    while (await this.db.folder.findFirst({ where: { tenantId, space, parentId, deletedAt: null, name: candidate }, select: { id: true } })) {
      candidate = `${sourceName} - copie ${index++}`;
    }
    return candidate;
  }

  private async targetAccess(targetSpace: Space, targetFolder: any | null) {
    if (targetSpace === 'PERSONAL') return { visibility: 'PRIVATE' as const, userIds: [] as string[], groupIds: [] as string[] };
    if (!targetFolder) return { visibility: 'COMPANY' as const, userIds: [] as string[], groupIds: [] as string[] };
    return {
      visibility: targetFolder.visibility,
      userIds: targetFolder.userAccesses?.map((x: any) => x.userId) || [],
      groupIds: targetFolder.groupAccesses?.map((x: any) => x.groupId) || [],
    };
  }

  private async copyDocument(tenantId: string, sourceId: string, targetFolderId: string, createdById: string) {
    const source = await this.db.document.findUniqueOrThrow({ where: { id: sourceId } });
    const id = randomUUID();
    const safe = source.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storageKey = `tenants/${tenantId}/documents/${id}/versions/1/${safe}`;
    await this.storage.copy(source.storageKey, storageKey);
    const copied = await this.db.document.create({
      data: {
        id,
        tenantId,
        folderId: targetFolderId,
        technicalNumber: `COF-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        name: source.name,
        extension: source.extension,
        mimeType: source.mimeType,
        sizeBytes: source.sizeBytes,
        storageKey,
        checksumSha256: source.checksumSha256,
        version: 1,
        status: 'ACTIVE',
        metadata: source.metadata as any,
        extractedText: source.extractedText,
        createdById,
      },
    });
    const chunks = await this.db.archiveChunk.findMany({ where: { tenantId, documentId: sourceId }, orderBy: { position: 'asc' } });
    if (chunks.length) {
      await this.db.archiveChunk.createMany({
        data: chunks.map((chunk) => ({ tenantId, documentId: copied.id, page: chunk.page, position: chunk.position, content: chunk.content, embedding: chunk.embedding as any })),
      });
    }
    return copied;
  }

  private async copyFolderRecursive(
    tenantId: string,
    sourceId: string,
    targetParentId: string | null,
    targetSpace: Space,
    createdById: string,
    access: { visibility: any; userIds: string[]; groupIds: string[] },
    root = false,
  ) {
    const source = await this.db.folder.findUniqueOrThrow({ where: { id: sourceId } });
    const name = root ? await this.uniqueFolderName(tenantId, targetSpace, targetParentId, source.name) : source.name;
    const copy = await this.db.folder.create({
      data: {
        tenantId,
        parentId: targetParentId,
        name,
        createdById,
        visibility: access.visibility,
        space: targetSpace,
        userAccesses: access.visibility === 'RESTRICTED' && access.userIds.length
          ? { create: access.userIds.map((userId) => ({ userId })) }
          : undefined,
        groupAccesses: access.visibility === 'RESTRICTED' && access.groupIds.length
          ? { create: access.groupIds.map((groupId) => ({ groupId })) }
          : undefined,
      },
    });
    const docs = await this.db.document.findMany({ where: { tenantId, folderId: sourceId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    for (const doc of docs) await this.copyDocument(tenantId, doc.id, copy.id, createdById);
    const children = await this.db.folder.findMany({ where: { tenantId, parentId: sourceId, deletedAt: null }, select: { id: true }, orderBy: { name: 'asc' } });
    for (const child of children) await this.copyFolderRecursive(tenantId, child.id, copy.id, targetSpace, createdById, access, false);
    return copy;
  }

  private async auditMany(tenantId: string, userId: string, action: string, entityType: string, ids: string[], details: any) {
    if (!ids.length) return;
    await this.db.auditLog.createMany({
      data: ids.map((entityId) => ({ tenantId, userId, action, entityType, entityId, details })),
    });
  }

  @Get('destinations')
  async destinations(@Req() req: any, @Query('space') requestedSpace = 'PERSONAL') {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const space: Space = requestedSpace === 'COMPANY' ? 'COMPANY' : 'PERSONAL';
    const folders = await this.db.folder.findMany({
      where: { tenantId, deletedAt: null, ...this.accessWhere(req, space) },
      select: { id: true, parentId: true, name: true, space: true },
      orderBy: { name: 'asc' },
    });
    const visibleIds = new Set(folders.map((folder) => folder.id));
    const byParent = new Map<string | null, any[]>();
    for (const folder of folders) {
      const parentId = folder.parentId && visibleIds.has(folder.parentId) ? folder.parentId : null;
      const list = byParent.get(parentId) || [];
      list.push({ ...folder, parentId });
      byParent.set(parentId, list);
    }
    const out: Array<{ id: string; parentId: string | null; name: string; path: string; space: Space }> = [];
    const walk = (parentId: string | null, prefix: string) => {
      for (const folder of byParent.get(parentId) || []) {
        const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
        out.push({ id: folder.id, parentId: folder.parentId, name: folder.name, path, space: folder.space as Space });
        walk(folder.id, path);
      }
    };
    walk(null, '');
    return out;
  }

  @Post('move')
  async move(@Req() req: any, @Body() dto: TransferDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const targetFolderId = dto.targetFolderId || null;
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    if (dto.sourceSpace === 'COMPANY' && dto.targetSpace === 'PERSONAL') throw new BadRequestException('Le déplacement de l’espace entreprise vers un espace personnel n’est pas autorisé');
    if (dto.sourceSpace !== dto.targetSpace && !targetFolderId) throw new BadRequestException('Choisissez un dossier de destination dans l’espace entreprise');
    if (documentIds.length && !targetFolderId) throw new BadRequestException('Les fichiers doivent être déplacés dans un dossier');
    await this.assertSelection(req, documentIds, folderIds, dto.sourceSpace);

    let target: any = null;
    if (targetFolderId) target = await this.folderAccessible(req, targetFolderId, dto.targetSpace);
    if (folderIds.includes(targetFolderId || '')) throw new BadRequestException('Impossible de déplacer un dossier dans lui-même');
    for (const folderId of folderIds) {
      const tree = await this.descendants(tenantId, [folderId]);
      if (targetFolderId && tree.includes(targetFolderId)) throw new BadRequestException('Impossible de déplacer un dossier dans un de ses sous-dossiers');
    }

    const selection = await this.selectedDocuments(tenantId, documentIds, folderIds);
    const bytes = selection.docs.reduce((sum, doc) => sum + doc.sizeBytes, 0n);
    if (dto.sourceSpace !== dto.targetSpace) await this.ensureQuota(req, dto.targetSpace, bytes);

    for (const folderId of folderIds) {
      const source = await this.db.folder.findUniqueOrThrow({ where: { id: folderId } });
      const conflict = await this.db.folder.findFirst({ where: { tenantId, space: dto.targetSpace, parentId: targetFolderId, deletedAt: null, name: source.name, id: { not: folderId } }, select: { id: true } });
      if (conflict) throw new BadRequestException(`Un dossier nommé « ${source.name} » existe déjà dans la destination`);
    }

    if (dto.sourceSpace !== dto.targetSpace && folderIds.length) {
      const access = await this.targetAccess(dto.targetSpace, target);
      for (const rootId of folderIds) {
        const tree = await this.descendants(tenantId, [rootId]);
        await this.db.$transaction(async (tx) => {
          await tx.folderUserAccess.deleteMany({ where: { folderId: { in: tree } } });
          await tx.folderGroupAccess.deleteMany({ where: { folderId: { in: tree } } });
          await tx.folder.updateMany({ where: { id: { in: tree }, tenantId }, data: { space: dto.targetSpace, visibility: access.visibility } });
          if (access.visibility === 'RESTRICTED') {
            for (const id of tree) {
              if (access.userIds.length) await tx.folderUserAccess.createMany({ data: access.userIds.map((userId: string) => ({ folderId: id, userId })), skipDuplicates: true });
              if (access.groupIds.length) await tx.folderGroupAccess.createMany({ data: access.groupIds.map((groupId: string) => ({ folderId: id, groupId })), skipDuplicates: true });
            }
          }
          await tx.folder.update({ where: { id: rootId }, data: { parentId: targetFolderId } });
        });
      }
    } else if (folderIds.length) {
      await this.db.folder.updateMany({ where: { tenantId, id: { in: folderIds } }, data: { parentId: targetFolderId } });
    }

    if (documentIds.length) {
      await this.db.document.updateMany({ where: { tenantId, id: { in: documentIds }, deletedAt: null }, data: { folderId: targetFolderId! } });
    }

    const details = { sourceSpace: dto.sourceSpace, targetSpace: dto.targetSpace, targetFolderId, targetFolderName: target?.name || null };
    await this.auditMany(tenantId, req.user.sub, 'DOCUMENT_MOVED', 'Document', selection.docs.map((d) => d.id), details);
    await this.auditMany(tenantId, req.user.sub, 'FOLDER_MOVED', 'Folder', folderIds, details);
    return { success: true };
  }

  @Post('copy')
  async copy(@Req() req: any, @Body() dto: TransferDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const targetFolderId = dto.targetFolderId || null;
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    if (dto.sourceSpace === 'COMPANY' && dto.targetSpace === 'PERSONAL') throw new BadRequestException('La copie de l’espace entreprise vers un espace personnel n’est pas autorisée');
    if (dto.sourceSpace !== dto.targetSpace && !targetFolderId) throw new BadRequestException('Choisissez un dossier de destination dans l’espace entreprise');
    if (documentIds.length && !targetFolderId) throw new BadRequestException('Les fichiers doivent être copiés dans un dossier');
    await this.assertSelection(req, documentIds, folderIds, dto.sourceSpace);

    let target: any = null;
    if (targetFolderId) target = await this.folderAccessible(req, targetFolderId, dto.targetSpace);
    for (const folderId of folderIds) {
      const tree = await this.descendants(tenantId, [folderId]);
      if (targetFolderId && tree.includes(targetFolderId)) throw new BadRequestException('Impossible de copier un dossier dans lui-même ou dans un de ses sous-dossiers');
    }

    const selection = await this.selectedDocuments(tenantId, documentIds, folderIds);
    const bytes = selection.docs.reduce((sum, doc) => sum + doc.sizeBytes, 0n);
    await this.ensureQuota(req, dto.targetSpace, bytes);
    const access = await this.targetAccess(dto.targetSpace, target);

    for (const documentId of documentIds) await this.copyDocument(tenantId, documentId, targetFolderId!, req.user.sub);
    for (const folderId of folderIds) await this.copyFolderRecursive(tenantId, folderId, targetFolderId, dto.targetSpace, req.user.sub, access, true);

    const details = { sourceSpace: dto.sourceSpace, targetSpace: dto.targetSpace, targetFolderId, targetFolderName: target?.name || null };
    await this.auditMany(tenantId, req.user.sub, 'DOCUMENT_COPIED', 'Document', selection.docs.map((d) => d.id), details);
    await this.auditMany(tenantId, req.user.sub, 'FOLDER_COPIED', 'Folder', folderIds, details);
    return { success: true, copiedDocuments: selection.docs.length, copiedFolders: folderIds.length };
  }

  @Patch('rename/:kind/:id')
  async rename(@Req() req: any, @Param('kind') kind: Kind, @Param('id') id: string, @Body() dto: RenameDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nom requis');
    if (kind === 'folder') {
      const folder = await this.folderAccessible(req, id);
      if (folder.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le créateur ou un administrateur peut renommer ce dossier');
      const result = await this.db.folder.update({ where: { id }, data: { name } });
      await this.db.auditLog.create({ data: { tenantId, userId: req.user.sub, action: 'FOLDER_RENAMED', entityType: 'Folder', entityId: id, details: { name } } });
      return result;
    }
    if (kind !== 'document') throw new BadRequestException('Type d’élément invalide');
    const doc = await this.documentAccessible(req, id);
    const result = await this.db.document.update({ where: { id }, data: { name, extension: name.includes('.') ? name.split('.').pop()?.toLowerCase() : null } });
    await this.db.auditLog.create({ data: { tenantId, userId: req.user.sub, action: 'DOCUMENT_RENAMED', entityType: 'Document', entityId: id, details: { name } } });
    return result;
  }

  @Get('documents/:id/download-url')
  async downloadUrl(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.tenant(req);
    const doc = await this.documentAccessible(req, id);
    if (doc.folder.space === 'COMPANY') {
      await this.db.auditLog.create({ data: { tenantId, userId: req.user.sub, action: 'DOCUMENT_DOWNLOADED', entityType: 'Document', entityId: id } });
    }
    return { url: await this.storage.downloadUrl(doc.storageKey, 'attachment') };
  }

  @Get('details/:kind/:id')
  async details(@Req() req: any, @Param('kind') kind: Kind, @Param('id') id: string) {
    const tenantId = this.tenant(req);
    let entityType: 'Document' | 'Folder';
    let item: any;
    if (kind === 'document') {
      const doc = await this.documentAccessible(req, id);
      if (doc.folder.space !== 'COMPANY') throw new ForbiddenException('Les détails d’activité sont disponibles dans l’espace entreprise');
      entityType = 'Document';
      item = doc;
    } else if (kind === 'folder') {
      const folder = await this.folderAccessible(req, id, 'COMPANY');
      entityType = 'Folder';
      item = await this.db.folder.findUniqueOrThrow({ where: { id }, include: { createdBy: { select: { id: true, name: true, email: true } } } });
    } else {
      throw new BadRequestException('Type d’élément invalide');
    }

    const modificationActions = entityType === 'Document' ? ['DOCUMENT_RENAMED', 'DOCUMENT_MOVED'] : ['FOLDER_RENAMED', 'FOLDER_MOVED'];
    const historyActions = entityType === 'Document'
      ? ['DOCUMENT_OPENED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_COPIED', 'DOCUMENT_MOVED']
      : ['FOLDER_COPIED', 'FOLDER_MOVED'];

    const [lastModification, history] = await Promise.all([
      this.db.auditLog.findFirst({
        where: { tenantId, entityType, entityId: id, action: { in: modificationActions } },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.db.auditLog.findMany({
        where: { tenantId, entityType, entityId: id, action: { in: historyActions } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const labels: Record<string, string> = {
      DOCUMENT_OPENED: 'Ouverture du fichier',
      DOCUMENT_DOWNLOADED: 'Téléchargement',
      DOCUMENT_COPIED: 'Copie',
      DOCUMENT_MOVED: 'Déplacement',
      FOLDER_COPIED: 'Copie',
      FOLDER_MOVED: 'Déplacement',
    };

    return {
      id,
      kind,
      name: item.name,
      importedAt: item.createdAt,
      importedBy: item.createdBy,
      lastModifiedAt: lastModification?.createdAt || item.createdAt,
      lastModifiedBy: lastModification?.user || item.createdBy,
      history: history.map((entry) => ({
        id: entry.id,
        action: entry.action,
        label: labels[entry.action] || entry.action,
        at: entry.createdAt,
        user: entry.user,
        details: entry.details,
      })),
    };
  }
}
