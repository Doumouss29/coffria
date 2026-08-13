import { BadRequestException, CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Observable, from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

@Injectable()
export class SignatureEntitlementInterceptor implements NestInterceptor {
  constructor(private db: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<any>();
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    const isSignatureArea = path === '/signatures' || path.startsWith('/signatures/') || path === '/signature-workspace' || path.startsWith('/signature-workspace/');
    const isPublic = path.startsWith('/signatures/public/');

    if (!isSignatureArea || isPublic || !req.user?.tenantId) return next.handle();

    const tenant = await this.db.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: { signatureEnabled: true, signatureUsageLimit: true, signatureUsageUsed: true },
    });
    if (!tenant?.signatureEnabled) throw new ForbiddenException('Le module Signature n’est pas inclus dans votre abonnement Coffria.');

    const createsRequest = req.method === 'POST' && path === '/signatures';
    if (createsRequest && tenant.signatureUsageLimit != null && tenant.signatureUsageUsed >= tenant.signatureUsageLimit) {
      throw new BadRequestException(`Quota de signatures atteint (${tenant.signatureUsageUsed}/${tenant.signatureUsageLimit}). Contactez votre administrateur Coffria.`);
    }

    if (!createsRequest) return next.handle();

    return next.handle().pipe(
      mergeMap((value) => from(this.db.tenant.update({
        where: { id: req.user.tenantId },
        data: { signatureUsageUsed: { increment: 1 } },
      })).pipe(map(() => value))),
    );
  }
}
