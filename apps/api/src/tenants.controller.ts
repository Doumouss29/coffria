import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

class CreateTenantDto {
  @IsString() name!: string;
  @IsInt() @Min(1) quotaGb!: number;
  @IsInt() @Min(1) maxUsers!: number;
  @IsOptional() @IsDateString() subscriptionExpiresAt?: string;
  @IsString() adminName!: string;
  @IsEmail() adminEmail!: string;
  @IsString() @MinLength(10) adminPassword!: string;
}
class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(1) quotaGb?: number;
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsOptional() @IsDateString() subscriptionExpiresAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class CreateTenantAdminDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
}
class UpdateTenantAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(10) password?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
}

@Controller('tenants')
@UseGuards(JwtGuard)
export class TenantsController {
  constructor(private db: PrismaService, private storage: StorageService) {}
  private check(req: any) { if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException(); }

  @Get()
  async list(@Req() req: any) {
    this.check(req);
    const tenants = await this.db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: 'TENANT_ADMIN' },
          select: { id: true, name: true, email: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { users: true, documents: true } },
      },
    });
    return tenants.map((tenant) => ({
      ...tenant,
      quotaGb: Number(tenant.storageQuotaBytes / 1073741824n),
      companyQuotaGb: Number(tenant.companyStorageQuotaBytes / 1073741824n),
      admins: tenant.users,
      admin: tenant.users[0] || null,
      users: undefined,
    }));
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTenantDto) {
    this.check(req);
    const slugBase = dto.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    return this.db.$transaction(async (tx) => {
      const totalBytes = BigInt(dto.quotaGb) * 1073741824n;
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name.trim(), slug,
          storageQuotaBytes: totalBytes,
          companyStorageQuotaBytes: totalBytes,
          maxUsers: dto.maxUsers,
          subscriptionExpiresAt: dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null,
        },
      });
      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.adminName.trim(),
          email: dto.adminEmail.trim().toLowerCase(),
          passwordHash: await bcrypt.hash(dto.adminPassword, 12),
          role: 'TENANT_ADMIN', status: 'ACTIVE',
        },
        select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      });
      return { ...tenant, quotaGb: dto.quotaGb, companyQuotaGb: dto.quotaGb, admin, admins: [admin] };
    });
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTenantDto) {
    this.check(req);
    const current = await this.db.tenant.findUniqueOrThrow({ where: { id } });
    if (dto.quotaGb !== undefined) {
      const nextTotal = BigInt(dto.quotaGb) * 1073741824n;
      const userAllocations = await this.db.user.aggregate({ _sum: { personalStorageQuotaBytes: true }, where: { tenantId: id } });
      const allocated = current.companyStorageQuotaBytes + (userAllocations._sum.personalStorageQuotaBytes || 0n);
      if (nextTotal < allocated) {
        throw new BadRequestException('Le nouveau quota total est inférieur aux volumes déjà alloués par l’administrateur de l’entreprise.');
      }
    }
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.quotaGb !== undefined) data.storageQuotaBytes = BigInt(dto.quotaGb) * 1073741824n;
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.subscriptionExpiresAt !== undefined) data.subscriptionExpiresAt = dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null;
    const tenant = await this.db.tenant.update({ where: { id }, data });
    return {
      ...tenant,
      quotaGb: Number(tenant.storageQuotaBytes / 1073741824n),
      companyQuotaGb: Number(tenant.companyStorageQuotaBytes / 1073741824n),
    };
  }

  @Delete(':id')
  async removeTenant(@Req() req: any, @Param('id') id: string) {
    this.check(req);
    const tenant = await this.db.tenant.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!tenant) throw new BadRequestException('Entreprise introuvable');
    await this.storage.deletePrefixPermanently(`tenants/${id}/`);
    await this.db.tenant.delete({ where: { id } });
    return { success: true, message: `Entreprise « ${tenant.name} » supprimée définitivement.` };
  }

  @Get(':id/admins')
  async listAdmins(@Req() req: any, @Param('id') id: string) {
    this.check(req);
    return this.db.user.findMany({ where: { tenantId: id, role: 'TENANT_ADMIN' }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, email: true, status: true, createdAt: true } });
  }

  @Post(':id/admins')
  async createAdmin(@Req() req: any, @Param('id') id: string, @Body() dto: CreateTenantAdminDto) {
    this.check(req);
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id } });
    const count = await this.db.user.count({ where: { tenantId: id } });
    if (count >= tenant.maxUsers) throw new BadRequestException('Nombre maximal d’utilisateurs atteint');
    return this.db.user.create({
      data: { tenantId: id, name: dto.name.trim(), email: dto.email.trim().toLowerCase(), passwordHash: await bcrypt.hash(dto.password, 12), role: 'TENANT_ADMIN', status: 'ACTIVE' },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
  }

  @Patch(':tenantId/admins/:adminId')
  async updateAdmin(@Req() req: any, @Param('tenantId') tenantId: string, @Param('adminId') adminId: string, @Body() dto: UpdateTenantAdminDto) {
    this.check(req);
    const admin = await this.db.user.findFirst({ where: { id: adminId, tenantId, role: 'TENANT_ADMIN' } });
    if (!admin) throw new BadRequestException('Administrateur introuvable');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.user.update({ where: { id: adminId }, data, select: { id: true, name: true, email: true, status: true, createdAt: true } });
  }

  @Delete(':tenantId/admins/:adminId')
  async removeAdmin(@Req() req: any, @Param('tenantId') tenantId: string, @Param('adminId') adminId: string) {
    this.check(req);
    const count = await this.db.user.count({ where: { tenantId, role: 'TENANT_ADMIN' } });
    if (count <= 1) throw new BadRequestException('Une entreprise doit conserver au moins un administrateur.');
    await this.db.user.deleteMany({ where: { id: adminId, tenantId, role: 'TENANT_ADMIN' } });
    return { success: true };
  }
}
