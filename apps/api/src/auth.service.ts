import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenant) throw new ForbiddenException('Entreprise introuvable');
      if (!user.tenant.active) throw new ForbiddenException("Votre entreprise n’est plus active. Contactez l’administrateur Coffria.");
      if (user.tenant.subscriptionExpiresAt && user.tenant.subscriptionExpiresAt < new Date()) {
        throw new ForbiddenException("L’abonnement de votre entreprise a expiré. Contactez l’administrateur Coffria.");
      }
    }

    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, tenantId: user.tenantId, role: user.role }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    return { success: true, message: 'Mot de passe modifié.' };
  }
}
