import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
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
  private normalizeSpace(value?: string): Space { return value === 'PERSONAL' ? 'PERSONAL' : 'COMPANY'; }
  private accessWhere(req: any, space?: Space): any {
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
        if (allowed.space === 'PERSONAL' && allowed.createdById !== req.user.sub) throw new ForbiddenException('Seul le propriétaire peut déplacer un dossier personnel');
        if (allowed.space === 'COMPANY' && req.user.role !== 'TENANT_ADMIN' && allowed.createdById !== req.user.sub) throw new ForbiddenException('Seul le créateur ou un administrateur peut déplacer un dossier');
        spaces.add(allowed.space as Space);
      }
    }
    if (documentIds.length) {
      const docs = await this.db.document.findMany({
        where: { tenantId, id: { in: documentIds }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, folder: { select: { space: true } } },
      });
      if (docs.length !== documentIds.length) throw new ForbiddenException('Un document sélectionné est introuvable ou non autorisé');
      for (const doc of docs) {
        const allowed = await this.db.document.count({
          where: { id: doc.id, tenantId, deletedAt: null, status: 'ACTIVE', folder: this.accessWhere(req, doc.folder.space as Space) },
        });
        if (!allowed) throw new ForbiddenException('Un document sélectionné est introuvable ou non autorisé');
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

  @Get('folders')
  async folderOptions(@Req() req: any, @Query('space') requestedSpace = 'COMPANY') {
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
    const out: Array<{ id: string; name: string; path: string }> = [];
    const walk = (parentId: string | null, prefix: string) => {
      for (const folder of byParent.get(parentId) || []) {
        const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
        out.push({ id: folder.id, name: folder.name, path });
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
      if (docs.length) await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } });
      for (const id of [...folderTree].reverse()) await tx.folder.deleteMany({ where: { id, tenantId, deletedAt: { not: null } } });
    });
    return { success: true, purgedDocuments: docs.length, purgedFolders: folderTree.length };
  }
}
