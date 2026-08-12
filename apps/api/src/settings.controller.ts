import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class UpdateTenantDto { @IsString() name!: string; }

@Controller('settings')
@UseGuards(JwtGuard)
export class SettingsController {
  constructor(private db: PrismaService) {}

  private tenant(req: any): string {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  @Get()
  get(@Req() req: any) {
    return this.db.tenant.findUniqueOrThrow({
      where: { id: this.tenant(req) },
      select: { id: true, name: true, slug: true, storageQuotaBytes: true, maxUsers: true, maxFileSizeBytes: true, active: true },
    });
  }

  @Patch()
  update(@Req() req: any, @Body() dto: UpdateTenantDto) {
    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(req.user.role)) throw new ForbiddenException();
    return this.db.tenant.update({ where: { id: this.tenant(req) }, data: { name: dto.name.trim() } });
  }
}
