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
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class CreateUserDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsIn(['TENANT_ADMIN', 'EDITOR', 'VIEWER']) role!: 'TENANT_ADMIN' | 'EDITOR' | 'VIEWER';
}
class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['TENANT_ADMIN', 'EDITOR', 'VIEWER']) role?: 'TENANT_ADMIN' | 'EDITOR' | 'VIEWER';
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED']) status?: 'ACTIVE' | 'SUSPENDED';
  @IsOptional() @IsString() @MinLength(10) password?: string;
}

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private db: PrismaService) {}

  private check(req: any): string {
    if (req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Action réservée aux administrateurs de l’entreprise');
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  @Get()
  list(@Req() req: any) {
    const tenantId = this.check(req);
    return this.db.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateUserDto) {
    const tenantId = this.check(req);
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const count = await this.db.user.count({ where: { tenantId } });
    if (count >= tenant.maxUsers) throw new BadRequestException('Nombre maximal d’utilisateurs atteint');
    return this.db.user.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: dto.role,
        status: 'ACTIVE',
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    const tenantId = this.check(req);
    const target = await this.db.user.findFirst({ where: { id, tenantId } });
    if (!target) throw new BadRequestException('Utilisateur introuvable');
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.check(req);
    if (id === req.user.sub) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    const target = await this.db.user.findFirst({ where: { id, tenantId } });
    if (!target) throw new BadRequestException('Utilisateur introuvable');
    if (target.role === 'TENANT_ADMIN') {
      const admins = await this.db.user.count({ where: { tenantId, role: 'TENANT_ADMIN', status: 'ACTIVE' } });
      if (admins <= 1) throw new BadRequestException('Au moins un administrateur actif doit rester dans l’entreprise.');
    }
    await this.db.user.delete({ where: { id } });
    return { success: true };
  }
}
