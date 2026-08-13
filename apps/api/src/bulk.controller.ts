import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

class SelectionDto {
  @IsArray() @IsString({ each: true }) documentIds!: string[];
  @IsArray() @IsString({ each: true }) folderIds!: string[];
}
class MoveDto extends SelectionDto { @IsOptional() @IsString() targetFolderId?: string; }

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
  private accessWhere(req: any): any {
    if (req.user.role === 'TENANT_ADMIN') return {};
    return {
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
  }

  private async assertDocuments(req: any, ids: string[]) {
    if (!ids.length) return;
    const count = await this.db.document.count({
      where: { id: { in: ids }, tenantId: this.tenant(req), deletedAt: null, status: 'ACTIVE', folder: this.accessWhere(req) },
    });
    if (count !== ids.length) throw new ForbiddenException('Un ou plusieurs fichiers sélectionnés sont inaccessibles.');
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
  async folderOptions(@Req() req: any) {
    const tenantId = this.tenant(req);
    const folders = await this.db.folder.findMany({
      where: { tenantId, deletedAt: null, ...this.accessWhere(req) },
      select: { id: true, parentId: true, name: true }, orderBy: { name: 'asc' },
    });
    const allowed = new Set(folders.map((f) => f.id));
    const byParent = new Map<string | null, any[]>();
    for (const folder of folders) {
      const parent = folder.parentId && allowed.has(folder.parentId) ? folder.parentId : null;
      const list = byParent.get(parent) || [];
      list.push(folder); byParent.set(parent, list);
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
    await this.assertDocuments(req, documentIds);
    if (folderIds.length) {
      this.canAdmin(req);
      const count = await this.db.folder.count({ where: { tenantId, id: { in: folderIds }, deletedAt: null } });
      if (count !== folderIds.length) throw new BadRequestException('Un dossier sélectionné est introuvable.');
    }
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
    if (!documentIds.length && !folderIds.length) throw new BadRequestException('Aucun élément sélectionné');
    await this.assertDocuments(req, documentIds);
    if (folderIds.length) {
      this.canAdmin(req);
      const count = await this.db.folder.count({ where: { tenantId, id: { in: folderIds }, deletedAt: null } });
      if (count !== folderIds.length) throw new BadRequestException('Un dossier sélectionné est introuvable.');
    }
    if (documentIds.length && !targetFolderId) throw new BadRequestException('Les fichiers doivent être déplacés dans un dossier.');
    if (targetFolderId) {
      const target = await this.db.folder.findFirst({ where: { id: targetFolderId, tenantId, deletedAt: null, ...this.accessWhere(req) } });
      if (!target) throw new ForbiddenException('Dossier de destination introuvable ou inaccessible');
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
    for (const doc of docs) await this.storage.delete(doc.storageKey).catch(() => undefined);
    await this.db.$transaction(async (tx) => {
      if (docs.length) await tx.document.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
      for (const id of [...folderTree].reverse()) await tx.folder.deleteMany({ where: { id, tenantId, deletedAt: { not: null } } });
    });
    return { success: true, purgedDocuments: docs.length, purgedFolders: folderTree.length };
  }
}
