import { Controller, Get, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

@Controller('dashboard')
@UseGuards(JwtGuard)
export class DashboardController {
  constructor(private db: PrismaService) {}

  @Get()
  async summary(@Req() req: any) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new ForbiddenException('Organisation requise');
    const [tenant, users, folders, documents, trashed, usage] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.db.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.db.folder.count({ where: { tenantId, deletedAt: null } }),
      this.db.document.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      this.db.document.count({ where: { tenantId, deletedAt: { not: null } } }),
      this.db.document.aggregate({ _sum: { sizeBytes: true }, where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
    ]);
    return {
      tenant: { name: tenant.name, maxUsers: tenant.maxUsers },
      users,
      folders,
      documents,
      trashed,
      storage: { usedBytes: String(usage._sum.sizeBytes || 0), limitBytes: String(tenant.storageQuotaBytes) },
    };
  }
}
