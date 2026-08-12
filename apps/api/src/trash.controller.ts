import { Controller, Delete, Get, Param, Post, Req, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Controller('trash')
@UseGuards(JwtGuard)
export class TrashController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any): string {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  private canAdmin(req: any): void {
    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(req.user.role)) {
      throw new ForbiddenException('Action réservée aux administrateurs');
    }
  }

  @Get()
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    const [folders, documents] = await Promise.all([
      this.db.folder.findMany({ where: { tenantId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } }),
      this.db.document.findMany({
        where: { tenantId, deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);
    return { folders, documents };
  }

  @Post('documents/:id/restore')
  async restoreDocument(@Req() req: any, @Param('id') id: string) {
    this.canAdmin(req);
    const doc = await this.db.document.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: { not: null } } });
    if (!doc) throw new NotFoundException('Document introuvable');
    return this.db.document.update({ where: { id }, data: { deletedAt: null, status: 'ACTIVE' } });
  }

  @Delete('documents/:id')
  async purgeDocument(@Req() req: any, @Param('id') id: string) {
    this.canAdmin(req);
    const doc = await this.db.document.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: { not: null } } });
    if (!doc) throw new NotFoundException('Document introuvable');
    await this.storage.delete(doc.storageKey);
    await this.db.document.delete({ where: { id } });
    return { success: true };
  }
}
