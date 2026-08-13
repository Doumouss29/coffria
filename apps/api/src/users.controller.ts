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
import { StorageService } from './storage.service';

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
class SavedSignatureDto {
  @IsString() @MinLength(20) signatureImage!: string;
}

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private check(req: any): string {
    if (req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Action réservée aux administrateurs de l’entreprise');
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  private async currentUser(req: any) {
    const user = await this.db.user.findUnique({ where: { id: req.user.sub }, select: { id: true, tenantId: true, email: true, name: true, status: true } });
    if (!user || !user.tenantId || user.status !== 'ACTIVE') throw new BadRequestException('Compte Coffria actif requis.');
    return user;
  }

  private signatureKey(tenantId: string, userId: string) {
    return `tenants/${tenantId}/users/${userId}/saved-signature.png`;
  }

  private decodeSignature(dataUrl: string) {
    const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException('La signature doit être une image PNG valide.');
    const bytes = Buffer.from(match[1], 'base64');
    if (!bytes.length || bytes.length > 500_000) throw new BadRequestException('La signature est vide ou trop volumineuse.');
    return bytes;
  }

  @Get('me/signature')
  async mySignature(@Req() req: any) {
    const user = await this.currentUser(req);
    const key = this.signatureKey(user.tenantId!, user.id);
    try {
      const bytes = await this.storage.readBuffer(key);
      return { saved: true, email: user.email, name: user.name, signatureImage: `data:image/png;base64,${bytes.toString('base64')}` };
    } catch {
      return { saved: false, email: user.email, name: user.name };
    }
  }

  @Post('me/signature')
  async saveMySignature(@Req() req: any, @Body() dto: SavedSignatureDto) {
    const user = await this.currentUser(req);
    const bytes = this.decodeSignature(dto.signatureImage);
    await this.storage.putBuffer(this.signatureKey(user.tenantId!, user.id), bytes, 'image/png');
    await this.db.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'SAVED_SIGNATURE_UPDATED', entityType: 'User', entityId: user.id, details: { storage: 'PRIVATE_S3' } } });
    return { success: true };
  }

  @Delete('me/signature')
  async deleteMySignature(@Req() req: any) {
    const user = await this.currentUser(req);
    await this.storage.delete(this.signatureKey(user.tenantId!, user.id)).catch(() => undefined);
    await this.db.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'SAVED_SIGNATURE_DELETED', entityType: 'User', entityId: user.id } });
    return { success: true };
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
