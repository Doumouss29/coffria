import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class AllocationDto {
  @IsInt()
  @Min(0)
  quotaGb!: number;
}

@Controller('storage-allocation')
@UseGuards(JwtGuard)
export class StorageAllocationController {
  constructor(private db: PrismaService) {}

  private tenant(req: any) {
    if (req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Action réservée aux administrateurs de l’entreprise');
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }

  private bytesFromGb(gb: number) {
    return BigInt(gb) * 1073741824n;
  }

  private async companyUsage(tenantId: string) {
    const [active, pending] = await Promise.all([
      this.db.document.aggregate({
        _sum: { sizeBytes: true },
        where: { tenantId, deletedAt: null, status: 'ACTIVE', folder: { space: 'COMPANY' } },
      }),
      this.db.document.aggregate({
        _sum: { sizeBytes: true },
        where: { tenantId, deletedAt: null, status: 'PENDING_UPLOAD', folder: { space: 'COMPANY' } },
      }),
    ]);
    return (active._sum.sizeBytes || 0n) + (pending._sum.sizeBytes || 0n);
  }

  private async userUsage(tenantId: string, userId: string) {
    const [active, pending] = await Promise.all([
      this.db.document.aggregate({
        _sum: { sizeBytes: true },
        where: { tenantId, deletedAt: null, status: 'ACTIVE', folder: { space: 'PERSONAL', createdById: userId } },
      }),
      this.db.document.aggregate({
        _sum: { sizeBytes: true },
        where: { tenantId, deletedAt: null, status: 'PENDING_UPLOAD', folder: { space: 'PERSONAL', createdById: userId } },
      }),
    ]);
    return (active._sum.sizeBytes || 0n) + (pending._sum.sizeBytes || 0n);
  }

  private async allocatedUsers(tenantId: string, excludeUserId?: string) {
    const users = await this.db.user.findMany({
      where: { tenantId, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
      select: { personalStorageQuotaBytes: true },
    });
    return users.reduce((sum, user) => sum + user.personalStorageQuotaBytes, 0n);
  }

  @Get()
  async summary(@Req() req: any) {
    const tenantId = this.tenant(req);
    const [tenant, users, companyUsed] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.db.user.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, role: true, status: true, personalStorageQuotaBytes: true },
      }),
      this.companyUsage(tenantId),
    ]);
    const userRows = await Promise.all(users.map(async (user) => ({
      ...user,
      quotaBytes: String(user.personalStorageQuotaBytes),
      usedBytes: String(await this.userUsage(tenantId, user.id)),
      personalStorageQuotaBytes: undefined,
    })));
    const personalAllocated = users.reduce((sum, user) => sum + user.personalStorageQuotaBytes, 0n);
    const allocated = tenant.companyStorageQuotaBytes + personalAllocated;
    return {
      totalBytes: String(tenant.storageQuotaBytes),
      company: {
        quotaBytes: String(tenant.companyStorageQuotaBytes),
        usedBytes: String(companyUsed),
      },
      personalAllocatedBytes: String(personalAllocated),
      allocatedBytes: String(allocated),
      unallocatedBytes: String(tenant.storageQuotaBytes > allocated ? tenant.storageQuotaBytes - allocated : 0n),
      users: userRows,
    };
  }

  @Patch('company')
  async updateCompany(@Req() req: any, @Body() dto: AllocationDto) {
    const tenantId = this.tenant(req);
    const [tenant, usersAllocated, used] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.allocatedUsers(tenantId),
      this.companyUsage(tenantId),
    ]);
    const quota = this.bytesFromGb(dto.quotaGb);
    if (quota < used) throw new BadRequestException('Le quota entreprise ne peut pas être inférieur à l’espace déjà consommé.');
    if (quota + usersAllocated > tenant.storageQuotaBytes) throw new BadRequestException('La somme des espaces alloués dépasse le volume total payé par l’entreprise.');
    await this.db.tenant.update({ where: { id: tenantId }, data: { companyStorageQuotaBytes: quota } });
    return { success: true };
  }

  @Patch('users/:userId')
  async updateUser(@Req() req: any, @Param('userId') userId: string, @Body() dto: AllocationDto) {
    const tenantId = this.tenant(req);
    const user = await this.db.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new BadRequestException('Utilisateur introuvable');
    const [tenant, othersAllocated, used] = await Promise.all([
      this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.allocatedUsers(tenantId, userId),
      this.userUsage(tenantId, userId),
    ]);
    const quota = this.bytesFromGb(dto.quotaGb);
    if (quota < used) throw new BadRequestException('Le quota personnel ne peut pas être inférieur à l’espace déjà consommé.');
    if (tenant.companyStorageQuotaBytes + othersAllocated + quota > tenant.storageQuotaBytes) {
      throw new BadRequestException('La somme des espaces alloués dépasse le volume total payé par l’entreprise.');
    }
    await this.db.user.update({ where: { id: userId }, data: { personalStorageQuotaBytes: quota } });
    return { success: true };
  }
}
