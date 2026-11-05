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
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';

class TenantAdminInputDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
}
class CreateTenantDto {
  @IsString() name!: string;
  @IsInt() @Min(1) quotaGb!: number;
  @IsInt() @Min(1) maxUsers!: number;
  @IsOptional() @IsDateString() subscriptionExpiresAt?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TenantAdminInputDto)
  admins!: TenantAdminInputDto[];
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
}
class UpdateTenantAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INVITED', 'SUSPENDED']) status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}

@Controller('tenants')
@UseGuards(JwtGuard)
export class TenantsController {
  constructor(private db: PrismaService, private storage: StorageService, private auth: AuthService) {}
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
    if (dto.admins.length > dto.maxUsers) throw new BadRequestException('Le nombre d’administrateurs dépasse le nombre maximal d’utilisateurs.');
    const emails = dto.admins.map((admin) => admin.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) throw new BadRequestException('Chaque administrateur doit avoir une adresse email différente.');
    const existing = await this.db.user.findFirst({ where: { email: { in: emails } }, select: { email: true } });
    if (existing) throw new BadRequestException(`Un compte existe déjà avec l’adresse ${existing.email}.`);

    const slugBase = dto.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const created = await this.db.$transaction(async (tx) => {
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
      const admins = [];
      for (const input of dto.admins) {
        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: input.name.trim(),
            email: input.email.trim().toLowerCase(),
            passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
            role: 'TENANT_ADMIN',
            status: 'INVITED',
          },
          select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
        });
        admins.push(admin);
      }
      return { ...tenant, quotaGb: dto.quotaGb, companyQuotaGb: dto.quotaGb, admin: admins[0], admins };
    });

    const invitations = await Promise.allSettled(created.admins.map((admin) => this.auth.sendAccountInvitation(admin.id)));
    return {
      ...created,
      invitationEmailFailures: invitations
        .map((result, index) => result.status === 'rejected' ? created.admins[index].email : null)
        .filter(Boolean),
    };
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
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new BadRequestException('Un compte existe déjà avec cette adresse email.');
    const admin = await this.db.user.create({
      data: {
        tenantId: id,
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        role: 'TENANT_ADMIN',
        status: 'INVITED',
      },
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    });
    let invitationSent = true;
    await this.auth.sendAccountInvitation(admin.id).catch(() => { invitationSent = false; });
    return { ...admin, invitationSent };
  }

  @Post(':tenantId/admins/:adminId/resend-invitation')
  async resendInvitation(@Req() req: any, @Param('tenantId') tenantId: string, @Param('adminId') adminId: string) {
    this.check(req);
    const admin = await this.db.user.findFirst({ where: { id: adminId, tenantId, role: 'TENANT_ADMIN' }, select: { id: true, status: true } });
    if (!admin) throw new BadRequestException('Administrateur introuvable');
    return this.auth.sendAccountInvitation(admin.id);
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
