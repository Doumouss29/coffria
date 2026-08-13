import { BadRequestException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';

@Controller('signature-workspace')
@UseGuards(JwtGuard)
export class SignatureWorkspaceController {
  constructor(private db: PrismaService) {}

  private tenant(req: any): string {
    if (!req.user?.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  private accessWhere(req: any): any {
    if (req.user.role === 'TENANT_ADMIN') return {};
    return {
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
  }

  @Get()
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    const [user, tenant] = await Promise.all([
      this.db.user.findUnique({ where: { id: req.user.sub }, select: { email: true } }),
      this.db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { signatureEnabled: true, signatureUsageLimit: true, signatureUsageUsed: true },
      }),
    ]);

    const visibility = req.user.role === 'TENANT_ADMIN'
      ? {}
      : {
          OR: [
            { createdById: req.user.sub },
            { sourceDocument: { folder: this.accessWhere(req) } },
            ...(user?.email ? [{ recipients: { some: { email: user.email.toLowerCase() } } }] : []),
          ],
        };

    const items = await this.db.signatureRequest.findMany({
      where: { tenantId, deletedAt: null, ...visibility },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceDocument: { select: { id: true, name: true } },
        finalDocument: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        recipients: { orderBy: { order: 'asc' } },
      },
    });

    return {
      items,
      entitlement: {
        enabled: tenant.signatureEnabled,
        used: tenant.signatureUsageUsed,
        limit: tenant.signatureUsageLimit,
        remaining: tenant.signatureUsageLimit == null ? null : Math.max(0, tenant.signatureUsageLimit - tenant.signatureUsageUsed),
      },
      currentUserEmail: user?.email || null,
    };
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string) {
    const request = await this.db.signatureRequest.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: null } });
    if (!request) throw new NotFoundException('Demande de signature introuvable');
    if (request.createdById !== req.user.sub && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Vous ne pouvez pas annuler cette demande.');
    if (request.status === 'COMPLETED') throw new BadRequestException('Une signature terminée ne peut pas être annulée.');
    return this.db.signatureRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const request = await this.db.signatureRequest.findFirst({ where: { id, tenantId: this.tenant(req), deletedAt: null } });
    if (!request) throw new NotFoundException('Demande de signature introuvable');
    if (request.createdById !== req.user.sub && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException('Vous ne pouvez pas retirer cette demande.');

    const data: any = { deletedAt: new Date() };
    if (!['COMPLETED', 'REFUSED', 'EXPIRED', 'CANCELLED'].includes(request.status)) data.status = 'CANCELLED';
    await this.db.signatureRequest.update({ where: { id }, data });
    await this.db.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: req.user.sub,
        action: 'SIGNATURE_REQUEST_HIDDEN',
        entityType: 'SignatureRequest',
        entityId: request.id,
        details: { previousStatus: request.status },
      },
    });
    return { success: true };
  }
}
