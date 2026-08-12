import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private db: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.db.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Compte inactif');
      if (user.role !== 'SUPER_ADMIN') {
        if (!user.tenant?.active) throw new ForbiddenException("Votre entreprise n’est plus active. Contactez l’administrateur Coffria.");
        if (user.tenant.subscriptionExpiresAt && user.tenant.subscriptionExpiresAt < new Date()) {
          throw new ForbiddenException("L’abonnement de votre entreprise a expiré. Contactez l’administrateur Coffria.");
        }
      }
      req.user = { ...payload, role: user.role, tenantId: user.tenantId };
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException();
    }
  }
}
