import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from 'crypto';

const QRCode = require('qrcode');

type MfaMethod = 'TOTP' | 'EMAIL';

@Injectable()
export class AuthService {
  constructor(private db: PrismaService, private jwt: JwtService) {}

  private async getLoginUser(email: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });
    return user;
  }

  private assertTenantAccess(user: any) {
    if (user.role === 'SUPER_ADMIN') return;
    if (!user.tenant) throw new ForbiddenException('Entreprise introuvable');
    if (!user.tenant.active) throw new ForbiddenException("Votre entreprise n’est plus active. Contactez l’administrateur Coffria.");
    if (user.tenant.subscriptionExpiresAt && user.tenant.subscriptionExpiresAt < new Date()) {
      throw new ForbiddenException("L’abonnement de votre entreprise a expiré. Contactez l’administrateur Coffria.");
    }
  }

  private allowedMethods(user: any): MfaMethod[] {
    if (user.role === 'SUPER_ADMIN') return ['TOTP'];
    const methods: MfaMethod[] = [];
    if (user.tenant?.mfaAllowTotp !== false) methods.push('TOTP');
    if (user.tenant?.mfaAllowEmail !== false) methods.push('EMAIL');
    return methods.length ? methods : ['TOTP'];
  }

  private sessionUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      signatureEnabled: user.role === 'SUPER_ADMIN' ? true : Boolean(user.tenant?.signatureEnabled),
      mfaEnabled: Boolean(user.mfaEnabled),
      mfaMethod: user.mfaMethod || null,
    };
  }

  private async issueSession(user: any, rememberDevice = false, userAgent?: string) {
    const result: any = {
      accessToken: await this.jwt.signAsync({ sub: user.id, tenantId: user.tenantId, role: user.role }),
      user: this.sessionUser(user),
    };
    if (rememberDevice) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = this.sha256(token);
      await this.db.trustedDevice.create({
        data: {
          userId: user.id,
          tokenHash,
          label: (userAgent || 'Appareil de confiance').slice(0, 240),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      result.trustedDeviceToken = token;
    }
    return result;
  }

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private encryptionKey() {
    return createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'coffria-mfa').digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decrypt(value: string) {
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new BadRequestException('Secret MFA invalide');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
  }

  private base32Encode(buffer: Buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
    let output = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      output += alphabet[parseInt(chunk, 2)];
    }
    return output;
  }

  private base32Decode(input: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
    let bits = '';
    for (const char of clean) {
      const index = alphabet.indexOf(char);
      if (index < 0) throw new BadRequestException('Secret TOTP invalide');
      bits += index.toString(2).padStart(5, '0');
    }
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return Buffer.from(bytes);
  }

  private totpCode(secret: string, stepOffset = 0) {
    const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', this.base32Decode(secret)).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private verifyTotp(secret: string, code: string) {
    const clean = code.replace(/\s/g, '');
    return [-1, 0, 1].some((offset) => this.totpCode(secret, offset) === clean);
  }

  private async recoveryCodes() {
    const plain = Array.from({ length: 10 }, () => `${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`);
    const hashes = await Promise.all(plain.map((code) => bcrypt.hash(code, 10)));
    return { plain, hashes };
  }

  private async verifyChallenge(challengeToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(challengeToken);
      if (payload?.purpose !== 'MFA_LOGIN' || !payload?.sub) throw new Error('purpose');
      const user = await this.db.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } });
      if (!user || user.status !== 'ACTIVE') throw new Error('user');
      this.assertTenantAccess(user);
      return user;
    } catch {
      throw new UnauthorizedException('La vérification de sécurité a expiré. Reconnectez-vous.');
    }
  }

  private async verifyAccountSetupToken(setupToken: string, purpose: string) {
    try {
      const payload = await this.jwt.verifyAsync(setupToken);
      if (payload?.purpose !== purpose || !payload?.sub) throw new Error('purpose');
      return payload;
    } catch {
      throw new UnauthorizedException('Cette opération de sécurité a expiré.');
    }
  }

  private async trustedDeviceValid(userId: string, token?: string) {
    if (!token) return false;
    const tokenHash = this.sha256(token);
    const device = await this.db.trustedDevice.findUnique({ where: { tokenHash } });
    if (!device || device.userId !== userId || device.expiresAt <= new Date()) return false;
    await this.db.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    return true;
  }

  async login(email: string, password: string, trustedDeviceToken?: string, userAgent?: string) {
    const user = await this.getLoginUser(email);
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Identifiants incorrects');
    }
    this.assertTenantAccess(user);

    const allowedMethods = this.allowedMethods(user);
    const configuredMethodAllowed = user.mfaMethod ? allowedMethods.includes(user.mfaMethod as MfaMethod) : false;
    if (user.mfaEnabled && configuredMethodAllowed && await this.trustedDeviceValid(user.id, trustedDeviceToken)) {
      return this.issueSession(user, false, userAgent);
    }

    const challengeToken = await this.jwt.signAsync(
      { sub: user.id, purpose: 'MFA_LOGIN' },
      { expiresIn: '10m' },
    );
    return {
      mfaRequired: true,
      setupRequired: !user.mfaEnabled,
      challengeToken,
      allowedMethods,
      preferredMethod: configuredMethodAllowed ? user.mfaMethod : (allowedMethods.includes('EMAIL') ? 'EMAIL' : 'TOTP'),
      hasTotp: Boolean(user.mfaSecretEncrypted),
      hasRecoveryCodes: Array.isArray(user.mfaRecoveryCodes) && (user.mfaRecoveryCodes as any[]).length > 0,
      emailHint: user.email.replace(/^(.{2}).*(@.*)$/, '$1••••$2'),
    };
  }

  async createTotpSetupForLogin(challengeToken: string) {
    const user = await this.verifyChallenge(challengeToken);
    if (!this.allowedMethods(user).includes('TOTP')) throw new ForbiddenException('La méthode Authenticator n’est pas autorisée pour ce compte.');
    const secret = this.base32Encode(randomBytes(20));
    const issuer = 'Coffria';
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
    const setupToken = await this.jwt.signAsync({ sub: user.id, purpose: 'MFA_TOTP_SETUP', secret: this.encrypt(secret) }, { expiresIn: '10m' });
    return { secret, qrDataUrl, setupToken };
  }

  async verifyTotpLogin(challengeToken: string, code: string, setupToken?: string, rememberDevice = false, userAgent?: string) {
    const user = await this.verifyChallenge(challengeToken);
    if (!this.allowedMethods(user).includes('TOTP')) throw new ForbiddenException('La méthode Authenticator n’est pas autorisée.');

    let secret: string;
    let isSetup = false;
    if (setupToken) {
      const payload = await this.verifyAccountSetupToken(setupToken, 'MFA_TOTP_SETUP');
      if (payload.sub !== user.id) throw new UnauthorizedException('Opération MFA invalide');
      secret = this.decrypt(payload.secret);
      isSetup = true;
    } else {
      if (!user.mfaSecretEncrypted) throw new BadRequestException('Authenticator n’est pas encore configuré.');
      secret = this.decrypt(user.mfaSecretEncrypted);
    }
    if (!this.verifyTotp(secret, code)) throw new UnauthorizedException('Code Authenticator incorrect');

    let recoveryPlain: string[] | undefined;
    if (isSetup || !user.mfaEnabled) {
      const recovery = await this.recoveryCodes();
      recoveryPlain = recovery.plain;
      await this.db.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaMethod: 'TOTP',
          mfaSecretEncrypted: this.encrypt(secret),
          mfaRecoveryCodes: recovery.hashes,
          mfaConfiguredAt: new Date(),
        },
      });
      user.mfaEnabled = true;
      user.mfaMethod = 'TOTP';
      user.mfaSecretEncrypted = this.encrypt(secret);
    }
    const session = await this.issueSession(user, rememberDevice, userAgent);
    if (recoveryPlain) session.recoveryCodes = recoveryPlain;
    return session;
  }

  private async sendEmail(user: any, code: string) {
    const host = process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
    const port = Number(process.env.BREVO_SMTP_PORT || 587);
    const smtpUser = process.env.BREVO_SMTP_LOGIN;
    const pass = process.env.BREVO_SMTP_KEY;
    const fromEmail = process.env.AUTH_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || 'contact.lmurbs@gmail.com';
    const fromName = process.env.AUTH_FROM_NAME || 'Coffria Sécurité';
    if (!smtpUser || !pass) throw new BadGatewayException('Le service email de sécurité Coffria n’est pas configuré.');
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: smtpUser, pass } });
    try {
      await transporter.sendMail({
        from: { name: fromName, address: fromEmail },
        to: user.email,
        subject: 'Votre code de sécurité Coffria',
        text: `Votre code de sécurité Coffria est ${code}. Il expire dans 5 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14213d"><h2>Vérification Coffria</h2><p>Votre code de sécurité :</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f5f1ea;padding:18px;text-align:center;border-radius:12px">${code}</div><p>Ce code expire dans <strong>5 minutes</strong>.</p><p style="color:#687386;font-size:13px">Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p></div>`,
      });
    } catch (error) {
      console.error('Coffria MFA email error', error);
      throw new BadGatewayException('Impossible d’envoyer le code de sécurité pour le moment.');
    }
  }

  private async issueEmailCode(user: any, purpose: string) {
    const last = await this.db.mfaEmailChallenge.findFirst({ where: { userId: user.id, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (last && Date.now() - last.createdAt.getTime() < 60_000) {
      throw new BadRequestException('Un code vient déjà d’être envoyé. Attendez une minute avant un nouvel envoi.');
    }
    const code = String(randomInt(100000, 1000000));
    await this.db.mfaEmailChallenge.create({
      data: { userId: user.id, purpose, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 5 * 60_000) },
    });
    await this.sendEmail(user, code);
    return { success: true, message: 'Un code à 6 chiffres vient de vous être envoyé par email.' };
  }

  private async consumeEmailCode(userId: string, purpose: string, code: string) {
    const challenge = await this.db.mfaEmailChallenge.findFirst({ where: { userId, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!challenge || challenge.expiresAt <= new Date()) throw new UnauthorizedException('Le code a expiré. Demandez un nouveau code.');
    if (challenge.attempts >= 5) throw new UnauthorizedException('Trop de tentatives. Demandez un nouveau code.');
    if (!(await bcrypt.compare(code, challenge.codeHash))) {
      await this.db.mfaEmailChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Code de sécurité incorrect');
    }
    await this.db.mfaEmailChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
  }

  async sendLoginEmailCode(challengeToken: string) {
    const user = await this.verifyChallenge(challengeToken);
    if (!this.allowedMethods(user).includes('EMAIL')) throw new ForbiddenException('La vérification par email n’est pas autorisée pour ce compte.');
    return this.issueEmailCode(user, 'LOGIN');
  }

  async verifyEmailLogin(challengeToken: string, code: string, rememberDevice = false, userAgent?: string) {
    const user = await this.verifyChallenge(challengeToken);
    if (!this.allowedMethods(user).includes('EMAIL')) throw new ForbiddenException('La vérification par email n’est pas autorisée.');
    await this.consumeEmailCode(user.id, 'LOGIN', code);
    let recoveryPlain: string[] | undefined;
    if (!user.mfaEnabled) {
      const recovery = await this.recoveryCodes();
      recoveryPlain = recovery.plain;
      await this.db.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaMethod: 'EMAIL', mfaRecoveryCodes: recovery.hashes, mfaConfiguredAt: new Date() } });
      user.mfaEnabled = true;
      user.mfaMethod = 'EMAIL';
    } else if (user.mfaMethod !== 'EMAIL' && !this.allowedMethods(user).includes(user.mfaMethod as MfaMethod)) {
      await this.db.user.update({ where: { id: user.id }, data: { mfaMethod: 'EMAIL' } });
      user.mfaMethod = 'EMAIL';
    }
    const session = await this.issueSession(user, rememberDevice, userAgent);
    if (recoveryPlain) session.recoveryCodes = recoveryPlain;
    return session;
  }

  async verifyRecoveryLogin(challengeToken: string, recoveryCode: string, rememberDevice = false, userAgent?: string) {
    const user = await this.verifyChallenge(challengeToken);
    const hashes = Array.isArray(user.mfaRecoveryCodes) ? (user.mfaRecoveryCodes as string[]) : [];
    let found = -1;
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(recoveryCode.trim().toUpperCase(), hashes[i])) { found = i; break; }
    }
    if (found < 0) throw new UnauthorizedException('Code de récupération invalide');
    hashes.splice(found, 1);
    await this.db.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: hashes } });
    return this.issueSession(user, rememberDevice, userAgent);
  }

  async mfaStatus(userId: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { tenant: true, trustedDevices: { where: { expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: 'desc' } } } });
    return {
      mandatory: true,
      enabled: user.mfaEnabled,
      method: user.mfaMethod,
      configuredAt: user.mfaConfiguredAt,
      allowedMethods: this.allowedMethods(user),
      recoveryCodesRemaining: Array.isArray(user.mfaRecoveryCodes) ? (user.mfaRecoveryCodes as any[]).length : 0,
      trustedDevices: user.trustedDevices.map((d: any) => ({ id: d.id, label: d.label, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt, expiresAt: d.expiresAt })),
    };
  }

  private async requirePassword(userId: string, currentPassword: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { tenant: true } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new UnauthorizedException('Mot de passe actuel incorrect');
    return user;
  }

  async accountTotpSetup(userId: string, currentPassword: string) {
    const user = await this.requirePassword(userId, currentPassword);
    if (!this.allowedMethods(user).includes('TOTP')) throw new ForbiddenException('Authenticator n’est pas autorisé par la politique de votre organisation.');
    const secret = this.base32Encode(randomBytes(20));
    const uri = `otpauth://totp/${encodeURIComponent('Coffria')}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Coffria&algorithm=SHA1&digits=6&period=30`;
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
    const setupToken = await this.jwt.signAsync({ sub: user.id, purpose: 'MFA_ACCOUNT_TOTP', secret: this.encrypt(secret) }, { expiresIn: '10m' });
    return { secret, qrDataUrl, setupToken };
  }

  async accountTotpConfirm(userId: string, setupToken: string, code: string) {
    const payload = await this.verifyAccountSetupToken(setupToken, 'MFA_ACCOUNT_TOTP');
    if (payload.sub !== userId) throw new UnauthorizedException('Opération MFA invalide');
    const secret = this.decrypt(payload.secret);
    if (!this.verifyTotp(secret, code)) throw new UnauthorizedException('Code Authenticator incorrect');
    const recovery = await this.recoveryCodes();
    await this.db.user.update({ where: { id: userId }, data: { mfaEnabled: true, mfaMethod: 'TOTP', mfaSecretEncrypted: this.encrypt(secret), mfaRecoveryCodes: recovery.hashes, mfaConfiguredAt: new Date() } });
    await this.db.trustedDevice.deleteMany({ where: { userId } });
    return { success: true, recoveryCodes: recovery.plain };
  }

  async accountEmailSend(userId: string, currentPassword: string) {
    const user = await this.requirePassword(userId, currentPassword);
    if (!this.allowedMethods(user).includes('EMAIL')) throw new ForbiddenException('La vérification par email n’est pas autorisée par la politique de votre organisation.');
    await this.issueEmailCode(user, 'ACCOUNT');
    const setupToken = await this.jwt.signAsync({ sub: user.id, purpose: 'MFA_ACCOUNT_EMAIL' }, { expiresIn: '10m' });
    return { success: true, setupToken, message: 'Code envoyé par email.' };
  }

  async accountEmailConfirm(userId: string, setupToken: string, code: string) {
    const payload = await this.verifyAccountSetupToken(setupToken, 'MFA_ACCOUNT_EMAIL');
    if (payload.sub !== userId) throw new UnauthorizedException('Opération MFA invalide');
    await this.consumeEmailCode(userId, 'ACCOUNT', code);
    const recovery = await this.recoveryCodes();
    await this.db.user.update({ where: { id: userId }, data: { mfaEnabled: true, mfaMethod: 'EMAIL', mfaRecoveryCodes: recovery.hashes, mfaConfiguredAt: new Date() } });
    await this.db.trustedDevice.deleteMany({ where: { userId } });
    return { success: true, recoveryCodes: recovery.plain };
  }

  async regenerateRecoveryCodes(userId: string, currentPassword: string) {
    await this.requirePassword(userId, currentPassword);
    const recovery = await this.recoveryCodes();
    await this.db.user.update({ where: { id: userId }, data: { mfaRecoveryCodes: recovery.hashes } });
    return { success: true, recoveryCodes: recovery.plain };
  }

  async revokeTrustedDevices(userId: string) {
    await this.db.trustedDevice.deleteMany({ where: { userId } });
    return { success: true, message: 'Tous les appareils de confiance ont été révoqués.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }
    await this.db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    await this.db.trustedDevice.deleteMany({ where: { userId } });
    return { success: true, message: 'Mot de passe modifié. Les appareils de confiance ont été révoqués.' };
  }
}
