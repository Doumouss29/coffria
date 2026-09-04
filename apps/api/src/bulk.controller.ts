import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { randomUUID } from 'crypto';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

type Space = 'COMPANY' | 'PERSONAL';

class SelectionDto {
  @IsArray() @IsString({ each: true }) documentIds!: string[];
  @IsArray() @IsString({ each: true }) folderIds!: string[];
}
class MoveDto extends SelectionDto {
  @IsOptional() @IsString() targetFolderId?: string;
  @IsOptional() @IsIn(['COMPANY', 'PERSONAL']) space?: Space;
}

@Controller('bulk')
@UseGuards(JwtGuard)
export class BulkController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }
  private canWrite(req: any) { if (req.user.role === 'VIEWER') throw new ForbiddenException('Action interdite'); }
  private canAdmin(req: any) { if (req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Action réservée à l’administrateur'); }
  private ids(dto: SelectionDto) { return { documentIds: [...new Set(dto.documentIds || [])], folderIds: [...new Set(dto.folderIds || [])] }; }
  private normalizeSpace(value?: string): Space { return value === 'COMPANY' ? 'COMPANY' : 'PERSONAL'; }
  private accessWhere(req: any, space?: Space): any {
    if (space === 'PERSONAL') return { space: 'PERSONAL', createdById: req.user.sub };
    if (space === 'COMPANY' && req.user.role === 'TENANT_ADMIN') return { space: 'COMPANY' };
    const base: any = {
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
    if (space) base.space = space;
    return base;
  }

  private async assertAccess(req: any, documentIds: string[], folderIds: string[]) {
    const tenantId = this.tenant(req);
    const spaces = new Set<Space>();
    if (folderIds.length) {
      const probes = await this.db.folder.findMany({ where: { tenantId, id: { in: folderIds }, deletedAt: null }, select: { id: true, space: true } });
      if (probes.length !== folderIds.length) throw new ForbiddenException('Un dossier sélectionné est introuvable ou non autorisé');
      for (const probe of probes) {
        const allowed = await this.db.folder.findFirst({ where: { id: probe.id, tenantId, deletedAt: null, ...this.accessWhere(req, probe.space as Space) }, select: { id: true, createdById: true, space: true } });
        if (!allowed) throw new ForbiddenException('Un dossier sélectionné est introuvable ou non autorisé');
        if (allowed.space === 'PERSONAL' && allowed.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut déplacer ou copier un dossier personnel');
        if (allowed.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && allowed.createdById !== req.user.sub) throw new ForbiddenException('Seul le créateur ou un administrateur peut déplacer ou copier ce dossier');
        spaces.add(allowed.space as Space);
      }
    }
    if (documentIds.length) {
      const docs = await this.db.document.findMany({
        where: { tenantId, id: { in: documentIds }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, folder: { select: { space: true, createdById: true } } },
      });
      if (docs.length !== documentIds.length) throw new ForbiddenException('Un document sélectionné est introuvable ou non autorisé');
      for (const doc of docs) {
        const allowed = await this.db.document.count({
          where: { id: doc.id, tenantId, deletedAt: null, status: 'ACTIVE', folder: this.accessWhere(req, doc.folder.space as Space) },
        });
        if (!allowed) throw new ForbiddenException('Un document sélectionné est introuvable ou non autorisé');
        if (doc.folder.space === 'PERSONAL' && doc.folder.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut déplacer ou copier un document personnel');
        spaces.add(doc.folder.space as Space);
      }
    }
    return spaces;
  }

  private async descendants(tenantId: string, rootIds: string[]) {
    const all = new Set(rootIds);
    let frontier = [...rootIds];
    while (frontier.length) {
      const children = await this.db.folder.findMany({ where: { tenantId, parentId: { in: frontier } }, select: { id: true } });
      frontier = children.map((x) => x.id).filter((id) => !all.has(id));
      frontier.forEach((id) => all.add(id));
    }
    return [...all];
  }

  private async quotaState(req: any, space: Space) {
    const tenantId = this.tenant(req);
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const folderFilter = space === 'PERSONAL'
      ? { space: 'PERSONAL' as const, createdById: req.user.sub }
      : { space: 'COMPANY' as const };
    const [usage, pending, user] = await Promise.all([
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'ACTIVE', folder: folderFilter } }),
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'PENDING_UPLOAD', folder: folderFilter } }),
      space === 'PERSONAL' ? this.db.user.findUniqueOrThrow({ where: { id: req.user.sub }, select: { personalStorageQuotaBytes: true } }) : Promise.resolve(null),
    ]);
    return {
      used: usage._sum.sizeBytes || 0n,
      pending: pending._sum.sizeBytes || 0n,
      limit: space === 'PERSONAL' ? (user?.personalStorageQuotaBytes || 0n) : tenant.companyStorageQuotaBytes,
    };
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

  private async uniqueFolderName(tenantId: string, space: Space, parentId: string | null, sourceName: string) {
    let candidate = `${sourceName} - copie`;
    let index = 2;
    while (await this.db.folder.findFirst({ where: { tenantId, space, parentId, deletedAt: null, name: candidate }, select: { id: true } })) {
      candidate = `${sourceName} - copie ${index++}`;
    }
    return candidate;
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

  private async copyFolderRecursive(tenantId: string, sourceId: string, targetParentId: string | null, createdById: string, root = false) {
    const source = await this.db.folder.findUniqueOrThrow({
      where: { id: sourceId },
      include: { userAccesses: true, groupAccesses: true },
    });
    const name = root ? await this.uniqueFolderName(tenantId, source.space as Space, targetParentId, source.name) : source.name;
    const copy = await this.db.folder.create({
      data: {
        tenantId,
        parentId: targetParentId,
        name,
        createdById,
        visibility: source.visibility,
        space: source.space,
        userAccesses: source.visibility === 'RESTRICTED' && source.userAccesses.length
          ? { create: source.userAccesses.map((access) => ({ userId: access.userId })) }
          : undefined,
        groupAccesses: source.visibility === 'RESTRICTED' && source.groupAccesses.length
          ? { create: source.groupAccesses.map((access) => ({ groupId: access.groupId })) }
          : undefined,
      },
    });
    const docs = await this.db.document.findMany({ where: { tenantId, folderId: sourceId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    for (const doc of docs) await this.copyDocument(tenantId, doc.id, copy.id, createdById);
    const children = await this.db.folder.findMany({ where: { tenantId, parentId: sourceId, deletedAt: null }, select: { id: true }, orderBy: { name: 'asc' } });
    for (const child of children) await this.copyFolderRecursive(tenantId, child.id, copy.id, createdById, false);
    return copy;
  }

  @Get('folders')
  async folderOptions(@Req() req: any, @Query('space') requestedSpace = 'PERSONAL') {
    const tenantId = this.tenant(req);
    const space = this.normalizeSpace(requestedSpace);
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
      list.push({ ...folder, parentId }); byParent.set(parentId, list);
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

  @Post('trash')
  async trash(@Req() req: any, @Body() dto: SelectionDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    const spaces = await this.assertAccess(req, documentIds, folderIds);
    if (folderIds.length && spaces.has('COMPANY') && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('La suppression de dossiers dans l’espace entreprise est réservée à l’administrateur');
    const folderTree = await this.descendants(tenantId, folderIds);
    const now = new Date();
    await this.db.$transaction([
      this.db.folder.updateMany({ where: { tenantId, id: { in: folderTree }, deletedAt: null }, data: { deletedAt: now } }),
      this.db.document.updateMany({ where: { tenantId, OR: [{ id: { in: documentIds } }, { folderId: { in: folderTree } }], deletedAt: null }, data: { deletedAt: now, status: 'TRASHED' } }),
    ]);
    return { success: true, folders: folderTree.length, documents: documentIds.length };
  }

  @Post('move')
  async move(@Req() req: any, @Body() dto: MoveDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const targetFolderId = dto.targetFolderId || null;
    const requestedSpace = this.normalizeSpace(dto.space);
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    if (documentIds.length && !targetFolderId) throw new BadRequestException('Les fichiers doivent être déplacés dans un dossier.');
    const sourceSpaces = await this.assertAccess(req, documentIds, folderIds);
    if (sourceSpaces.size > 1) throw new BadRequestException('Impossible de déplacer en une fois des éléments provenant de plusieurs espaces');
    const sourceSpace = sourceSpaces.values().next().value as Space | undefined;
    if (sourceSpace && sourceSpace !== requestedSpace) throw new BadRequestException('L’espace source ne correspond pas à la vue active');
    if (targetFolderId) {
      const target = await this.db.folder.findFirst({ where: { id: targetFolderId, tenantId, deletedAt: null, ...this.accessWhere(req, requestedSpace) } });
      if (!target) throw new BadRequestException('Dossier de destination introuvable ou non autorisé');
      if (target.space !== requestedSpace) throw new BadRequestException('Impossible de déplacer un élément vers un autre espace');
      if (target.space === 'PERSONAL' && target.createdById !== req.user.sub) throw new ForbiddenException('Destination personnelle non autorisée');
    }
    if (folderIds.includes(targetFolderId || '')) throw new BadRequestException('Impossible de déplacer un dossier dans lui-même');
    for (const folderId of folderIds) {
      const tree = await this.descendants(tenantId, [folderId]);
      if (targetFolderId && tree.includes(targetFolderId)) throw new BadRequestException('Impossible de déplacer un dossier dans un de ses sous-dossiers');
    }
    const operations: any[] = [];
    if (documentIds.length) operations.push(this.db.document.updateMany({ where: { tenantId, id: { in: documentIds }, deletedAt: null }, data: { folderId: targetFolderId! } }));
    if (folderIds.length) operations.push(this.db.folder.updateMany({ where: { tenantId, id: { in: folderIds }, deletedAt: null }, data: { parentId: targetFolderId } }));
    await this.db.$transaction(operations);
    return { success: true };
  }

  @Post('copy')
  async copy(@Req() req: any, @Body() dto: MoveDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const targetFolderId = dto.targetFolderId || null;
    const requestedSpace = this.normalizeSpace(dto.space);
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    if (documentIds.length && !targetFolderId) throw new BadRequestException('Les fichiers doivent être copiés dans un dossier.');
    const sourceSpaces = await this.assertAccess(req, documentIds, folderIds);
    if (sourceSpaces.size > 1) throw new BadRequestException('Impossible de copier en une fois des éléments provenant de plusieurs espaces');
    const sourceSpace = sourceSpaces.values().next().value as Space | undefined;
    if (sourceSpace && sourceSpace !== requestedSpace) throw new BadRequestException('La copie doit rester dans l’espace documentaire actif');
    if (targetFolderId) {
      const target = await this.db.folder.findFirst({ where: { id: targetFolderId, tenantId, deletedAt: null, ...this.accessWhere(req, requestedSpace) } });
      if (!target) throw new BadRequestException('Dossier de destination introuvable ou non autorisé');
      if (target.space !== requestedSpace) throw new BadRequestException('La copie entre espaces n’est pas autorisée depuis cette action');
      if (target.space === 'PERSONAL' && target.createdById !== req.user.sub) throw new ForbiddenException('Destination personnelle non autorisée');
    }
    for (const folderId of folderIds) {
      const tree = await this.descendants(tenantId, [folderId]);
      if (targetFolderId && tree.includes(targetFolderId)) throw new BadRequestException('Impossible de copier un dossier dans lui-même ou dans un de ses sous-dossiers');
    }
    const selection = await this.selectedDocuments(tenantId, documentIds, folderIds);
    const bytesToCopy = selection.docs.reduce((sum, doc) => sum + doc.sizeBytes, 0n);
    const quota = await this.quotaState(req, requestedSpace);
    if (bytesToCopy > 0n && (quota.limit <= 0n || quota.used + quota.pending + bytesToCopy > quota.limit)) {
      throw new BadRequestException(requestedSpace === 'PERSONAL' ? 'Espace personnel insuffisant pour effectuer cette copie' : 'Espace entreprise insuffisant pour effectuer cette copie');
    }
    for (const documentId of documentIds) await this.copyDocument(tenantId, documentId, targetFolderId!, req.user.sub);
    for (const folderId of folderIds) await this.copyFolderRecursive(tenantId, folderId, targetFolderId, req.user.sub, true);
    return { success: true, copiedDocuments: selection.docs.length, copiedFolders: folderIds.length };
  }

  @Post('trash/restore')
  async restore(@Req() req: any, @Body() dto: SelectionDto) {
    this.canAdmin(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const folderTree = await this.descendants(tenantId, folderIds);
    await this.db.$transaction([
      this.db.folder.updateMany({ where: { tenantId, id: { in: folderTree }, deletedAt: { not: null } }, data: { deletedAt: null } }),
      this.db.document.updateMany({ where: { tenantId, OR: [{ id: { in: documentIds } }, { folderId: { in: folderTree } }], deletedAt: { not: null } }, data: { deletedAt: null, status: 'ACTIVE' } }),
    ]);
    return { success: true };
  }

  @Post('trash/purge')
  async purge(@Req() req: any, @Body() dto: SelectionDto) {
    this.canAdmin(req);
    const tenantId = this.tenant(req);
    const { documentIds, folderIds } = this.ids(dto);
    const folderTree = await this.descendants(tenantId, folderIds);
    const docs = await this.db.document.findMany({ where: { tenantId, deletedAt: { not: null }, OR: [{ id: { in: documentIds } }, { folderId: { in: folderTree } }] }, select: { id: true, storageKey: true } });
    for (const doc of docs) await this.storage.deletePrefixPermanently(doc.storageKey).catch(() => this.storage.delete(doc.storageKey).catch(() => undefined));
    await this.db.$transaction(async (tx) => {
      if (docs.length) await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
      for (const id of [...folderTree].reverse()) await tx.folder.deleteMany({ where: { id, tenantId, deletedAt: { not: null } } });
    });
    return { success: true, purgedDocuments: docs.length, purgedFolders: folderTree.length };
  }
}
