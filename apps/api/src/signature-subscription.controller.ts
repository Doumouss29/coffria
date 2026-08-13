import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

class SignatureOptionDto {
  @IsBoolean() signatureEnabled!: boolean;
  @IsOptional() @IsInt() @Min(0) signatureUsageLimit?: number;
}

@Controller('signature-subscription')
@UseGuards(JwtGuard)
export class SignatureSubscriptionController {
  constructor(private db: PrismaService) {}

  @Get()
  async current(@Req() req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: req.user.tenantId },
      select: { signatureEnabled: true, signatureUsageLimit: true, signatureUsageUsed: true },
    });
    return {
      ...tenant,
      remaining: tenant.signatureUsageLimit == null ? null : Math.max(0, tenant.signatureUsageLimit - tenant.signatureUsageUsed),
    };
  }

  @Patch('admin/:tenantId')
  async configure(@Req() req: any, @Param('tenantId') tenantId: string, @Body() dto: SignatureOptionDto) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Action réservée au Super Admin');
    const tenant = await this.db.tenant.update({
      where: { id: tenantId },
      data: {
        signatureEnabled: dto.signatureEnabled,
        signatureUsageLimit: dto.signatureUsageLimit && dto.signatureUsageLimit > 0 ? dto.signatureUsageLimit : null,
      },
      select: { id: true, signatureEnabled: true, signatureUsageLimit: true, signatureUsageUsed: true },
    });
    return tenant;
  }

  @Post('admin/:tenantId/reset')
  async reset(@Req() req: any, @Param('tenantId') tenantId: string) {
    if (req.user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Action réservée au Super Admin');
    return this.db.tenant.update({
      where: { id: tenantId },
      data: { signatureUsageUsed: 0 },
      select: { id: true, signatureEnabled: true, signatureUsageLimit: true, signatureUsageUsed: true },
    });
  }
}
