import { BadRequestException, Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

class SavedSignatureDto {
  @IsString() @MinLength(20) signatureImage!: string;
}

@Controller('signature-profile')
@UseGuards(JwtGuard)
export class SignatureProfileController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private decodePng(dataUrl: string) {
    const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException('La signature doit être une image PNG valide.');
    const bytes = Buffer.from(match[1], 'base64');
    if (!bytes.length || bytes.length > 500_000) throw new BadRequestException('La signature est vide ou trop volumineuse.');
    return bytes;
  }

  private key(tenantId: string, userId: string) {
    return `tenants/${tenantId}/users/${userId}/saved-signature.png`;
  }

  private async currentUser(req: any) {
    const user = await this.db.user.findUnique({ where: { id: req.user.sub }, select: { id: true, tenantId: true, email: true, name: true, status: true } });
    if (!user || !user.tenantId || user.status !== 'ACTIVE') throw new BadRequestException('Compte Coffria actif requis.');
    return user;
  }

  @Get()
  async get(@Req() req: any) {
    const user = await this.currentUser(req);
    const key = this.key(user.tenantId!, user.id);
    try {
      const bytes = await this.storage.readBuffer(key);
      return { saved: true, email: user.email, name: user.name, signatureImage: `data:image/png;base64,${bytes.toString('base64')}` };
    } catch {
      return { saved: false, email: user.email, name: user.name };
    }
  }

  @Post()
  async save(@Req() req: any, @Body() dto: SavedSignatureDto) {
    const user = await this.currentUser(req);
    const bytes = this.decodePng(dto.signatureImage);
    const key = this.key(user.tenantId!, user.id);
    await this.storage.putBuffer(key, bytes, 'image/png');
    await this.db.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'SAVED_SIGNATURE_UPDATED', entityType: 'User', entityId: user.id, details: { storage: 'PRIVATE_S3' } } });
    return { success: true };
  }

  @Delete()
  async remove(@Req() req: any) {
    const user = await this.currentUser(req);
    const key = this.key(user.tenantId!, user.id);
    await this.storage.delete(key).catch(() => undefined);
    await this.db.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'SAVED_SIGNATURE_DELETED', entityType: 'User', entityId: user.id } });
    return { success: true };
  }
}
