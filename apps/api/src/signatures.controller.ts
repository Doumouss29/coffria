import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

class RecipientDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail() email!: string;
}
class CreateSignatureDto {
  @IsString() documentId!: string;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecipientDto) recipients!: RecipientDto[];
}
class SignDto { @IsString() @MinLength(2) signatureText!: string; }
class RefuseDto { @IsOptional() @IsString() reason?: string; }

@Controller('signatures')
export class SignaturesController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any) {
    if (!req.user?.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }
  private canWrite(req: any) {
    if (req.user.role === 'VIEWER') throw new ForbiddenException('Action interdite');
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
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private appUrl() {
    const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL?.split(',')[0] || 'https://coffria.ci';
    return configured.trim().replace(/\/$/, '');
  }
  private escape(value: string) { return value.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c)); }

  private async sendInvitation(email: string, name: string, title: string, token: string, message?: string | null) {
    const user = process.env.BREVO_SMTP_LOGIN;
    const pass = process.env.BREVO_SMTP_KEY;
    if (!user || !pass) return;
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: Number(process.env.BREVO_SMTP_PORT || 587) === 465,
      auth: { user, pass },
    });
    const fromEmail = process.env.CONTACT_FROM_EMAIL || 'contact@coffria.ci';
    const link = `${this.appUrl()}/signature/${encodeURIComponent(token)}`;
    await transporter.sendMail({
      from: { name: 'Coffria', address: fromEmail },
      to: email,
      subject: `Signature requise — ${title}`,
      text: `Bonjour ${name},\n\nUn document vous attend pour signature dans Coffria.\n${message || ''}\n\n${link}`,
      html: `<div style="font-family:Arial,sans-serif;color:#14213d;max-width:650px;margin:auto"><h2>Signature requise dans Coffria</h2><p>Bonjour ${this.escape(name)},</p><p>Le document <strong>${this.escape(title)}</strong> vous attend pour signature.</p>${message ? `<p>${this.escape(message)}</p>` : ''}<p><a href="${link}" style="display:inline-block;background:#d07b35;color:white;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Consulter et signer</a></p><p style="color:#7a8494;font-size:12px">Ce lien est personnel. Ne le transmettez pas.</p></div>`,
    });
  }

  @Get()
  @UseGuards(JwtGuard)
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    return this.db.signatureRequest.findMany({
      where: { tenantId, ...(req.user.role === 'TENANT_ADMIN' ? {} : { OR: [{ createdById: req.user.sub }, { sourceDocument: { folder: this.accessWhere(req) } }] }) },
      orderBy: { createdAt: 'desc' },
      include: { sourceDocument: { select: { id: true, name: true } }, finalDocument: { select: { id: true, name: true } }, recipients: { orderBy: { order: 'asc' } } },
    });
  }

  @Post()
  @UseGuards(JwtGuard)
  async create(@Req() req: any, @Body() dto: CreateSignatureDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id: dto.documentId, tenantId, deletedAt: null, status: 'ACTIVE', folder: this.accessWhere(req) } });
    if (!doc) throw new NotFoundException('Document introuvable ou inaccessible');
    if ((doc.extension || '').toLowerCase() !== 'pdf') throw new BadRequestException('La signature Coffria est disponible sur les documents PDF.');
    if (!dto.recipients?.length) throw new BadRequestException('Ajoutez au moins un signataire.');
    if (dto.recipients.length > 25) throw new BadRequestException('Maximum 25 signataires par circuit.');

    const recipients = dto.recipients.map((r, index) => ({ ...r, order: index + 1, token: randomBytes(32).toString('hex') }));
    const request = await this.db.signatureRequest.create({
      data: {
        tenantId, sourceDocumentId: doc.id, createdById: req.user.sub, title: dto.title.trim(), message: dto.message?.trim() || null,
        status: 'PENDING', currentStorageKey: doc.storageKey, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        recipients: { create: recipients.map((r) => ({ name: r.name.trim(), email: r.email.toLowerCase().trim(), order: r.order, tokenHash: this.hash(r.token) })) },
      },
      include: { recipients: { orderBy: { order: 'asc' } }, sourceDocument: true },
    });
    const first = recipients[0];
    await this.sendInvitation(first.email, first.name, request.title, first.token, request.message).catch((e) => console.error('Signature invitation email error', e));
    await this.db.auditLog.create({ data: { tenantId, userId: req.user.sub, action: 'SIGNATURE_REQUEST_CREATED', entityType: 'SignatureRequest', entityId: request.id, details: { documentId: doc.id, recipients: recipients.map((r) => r.email) } } });
    return request;
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  async detail(@Req() req: any, @Param('id') id: string) {
    const request = await this.db.signatureRequest.findFirst({
      where: { id, tenantId: this.tenant(req), ...(req.user.role === 'TENANT_ADMIN' ? {} : { OR: [{ createdById: req.user.sub }, { sourceDocument: { folder: this.accessWhere(req) } }] }) },
      include: { sourceDocument: true, finalDocument: true, recipients: { orderBy: { order: 'asc' } } },
    });
    if (!request) throw new NotFoundException('Demande introuvable');
    return request;
  }

  @Post(':id/cancel')
  @UseGuards(JwtGuard)
  async cancel(@Req() req: any, @Param('id') id: string) {
    const request = await this.db.signatureRequest.findFirst({ where: { id, tenantId: this.tenant(req) } });
    if (!request) throw new NotFoundException();
    if (request.createdById !== req.user.sub && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException();
    if (request.status === 'COMPLETED') throw new BadRequestException('Une signature terminée ne peut pas être annulée.');
    return this.db.signatureRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  @Get('public/:token')
  async publicDetail(@Param('token') token: string) {
    const recipient = await this.db.signatureRecipient.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { request: { include: { sourceDocument: { select: { name: true } }, recipients: { orderBy: { order: 'asc' }, select: { name: true, order: true, status: true, signedAt: true } } } } },
    });
    if (!recipient) throw new NotFoundException('Lien de signature invalide');
    const request = recipient.request;
    if (request.expiresAt && request.expiresAt < new Date()) {
      await this.db.signatureRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED' } }).catch(() => undefined);
      throw new BadRequestException('Cette demande de signature a expiré.');
    }
    if (['CANCELLED', 'EXPIRED', 'REFUSED'].includes(request.status)) throw new BadRequestException('Cette demande de signature n’est plus active.');
    const previousPending = request.recipients.some((r: any) => r.order < recipient.order && r.status !== 'SIGNED');
    if (previousPending) return { waiting: true, recipient: { name: recipient.name, status: recipient.status }, request: { title: request.title, message: request.message, documentName: request.sourceDocument.name, status: request.status, recipients: request.recipients } };
    if (!recipient.viewedAt) await this.db.signatureRecipient.update({ where: { id: recipient.id }, data: { viewedAt: new Date(), status: recipient.status === 'PENDING' ? 'VIEWED' : recipient.status } });
    return { waiting: false, recipient: { name: recipient.name, email: recipient.email, status: recipient.status }, request: { title: request.title, message: request.message, documentName: request.sourceDocument.name, status: request.status, recipients: request.recipients }, documentUrl: await this.storage.downloadUrl(request.currentStorageKey, 'inline') };
  }

  @Post('public/:token/sign')
  async sign(@Req() req: any, @Param('token') token: string, @Body() dto: SignDto) {
    const recipient = await this.db.signatureRecipient.findUnique({ where: { tokenHash: this.hash(token) }, include: { request: { include: { sourceDocument: true, recipients: { orderBy: { order: 'asc' } } } } } });
    if (!recipient) throw new NotFoundException('Lien invalide');
    if (recipient.status === 'SIGNED') throw new BadRequestException('Vous avez déjà signé ce document.');
    const request = recipient.request;
    if (!['PENDING', 'PARTIALLY_SIGNED'].includes(request.status)) throw new BadRequestException('Cette demande n’est plus signable.');
    if (request.expiresAt && request.expiresAt < new Date()) throw new BadRequestException('Cette demande a expiré.');
    if (request.recipients.some((r: any) => r.order < recipient.order && r.status !== 'SIGNED')) throw new BadRequestException('Le document attend encore une signature précédente.');

    const signedAt = new Date();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const userAgent = String(req.headers['user-agent'] || '');
    const input = await this.storage.readBuffer(request.currentStorageKey);
    const pdf = await PDFDocument.load(input);
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    page.drawText('COFFRIA — PREUVE DE SIGNATURE', { x: 48, y: 770, size: 18, font: bold, color: rgb(0.08, 0.13, 0.24) });
    page.drawText(`Circuit : ${request.title}`, { x: 48, y: 735, size: 11, font, color: rgb(0.25, 0.3, 0.4) });
    page.drawRectangle({ x: 48, y: 570, width: 499, height: 125, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 1 });
    page.drawText(`Signature Coffria #${recipient.order}`, { x: 68, y: 660, size: 13, font: bold, color: rgb(0.08, 0.13, 0.24) });
    page.drawText(`Signataire : ${dto.signatureText.trim()}`, { x: 68, y: 630, size: 12, font: bold, color: rgb(0.82, 0.43, 0.16) });
    page.drawText(`Identité déclarée : ${recipient.name} <${recipient.email}>`, { x: 68, y: 605, size: 9, font });
    page.drawText(`Date UTC : ${signedAt.toISOString()}`, { x: 68, y: 585, size: 9, font });
    page.drawText(`Adresse IP : ${ip || 'non disponible'}`, { x: 48, y: 525, size: 8, font, color: rgb(0.35, 0.39, 0.48) });
    page.drawText('Le document original précède cette page de preuve. Chaque signature ajoute une page de traçabilité sans masquer le contenu existant.', { x: 48, y: 485, size: 8, font, color: rgb(0.35, 0.39, 0.48), maxWidth: 490, lineHeight: 12 });
    const bytes = Buffer.from(await pdf.save());
    const digest = createHash('sha256').update(bytes).digest('hex');
    const signedKey = `tenants/${request.tenantId}/signatures/${request.id}/${recipient.order}-${randomUUID()}.pdf`;
    await this.storage.putBuffer(signedKey, bytes, 'application/pdf');

    const next = request.recipients.find((r: any) => r.order === recipient.order + 1);
    const isFinal = !next;
    let finalDocumentId: string | undefined;
    if (isFinal) {
      const id = randomUUID();
      const finalName = request.sourceDocument.name.replace(/\.pdf$/i, '') + '-signe.pdf';
      const finalKey = `tenants/${request.tenantId}/documents/${id}/versions/1/${finalName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
      await this.storage.putBuffer(finalKey, bytes, 'application/pdf');
      const finalDoc = await this.db.document.create({ data: {
        id, tenantId: request.tenantId, folderId: request.sourceDocument.folderId, technicalNumber: `COF-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        name: finalName, extension: 'pdf', mimeType: 'application/pdf', sizeBytes: BigInt(bytes.length), storageKey: finalKey, checksumSha256: digest, status: 'ACTIVE', createdById: request.createdById,
        metadata: { signedByCoffria: true, signatureRequestId: request.id, completedAt: signedAt.toISOString() },
      } });
      finalDocumentId = finalDoc.id;
    }

    await this.db.$transaction([
      this.db.signatureRecipient.update({ where: { id: recipient.id }, data: { status: 'SIGNED', signedAt, signatureText: dto.signatureText.trim(), ipAddress: ip || null, userAgent: userAgent || null, evidence: { tokenHash: recipient.tokenHash, signedAt: signedAt.toISOString(), sha256: digest } } }),
      this.db.signatureRequest.update({ where: { id: request.id }, data: { currentStorageKey: signedKey, status: isFinal ? 'COMPLETED' : 'PARTIALLY_SIGNED', completedAt: isFinal ? signedAt : null, finalDocumentId: finalDocumentId || null } }),
      this.db.auditLog.create({ data: { tenantId: request.tenantId, action: 'DOCUMENT_SIGNED', entityType: 'SignatureRequest', entityId: request.id, ipAddress: ip || null, userAgent: userAgent || null, details: { recipientEmail: recipient.email, order: recipient.order, sha256: digest } } }),
    ]);

    if (next) {
      const nextToken = randomBytes(32).toString('hex');
      await this.db.signatureRecipient.update({ where: { id: next.id }, data: { tokenHash: this.hash(nextToken) } });
      await this.sendInvitation(next.email, next.name, request.title, nextToken, request.message).catch((e) => console.error('Signature invitation email error', e));
    }
    return { success: true, completed: isFinal, finalDocumentId };
  }

  @Post('public/:token/refuse')
  async refuse(@Req() req: any, @Param('token') token: string, @Body() dto: RefuseDto) {
    const recipient = await this.db.signatureRecipient.findUnique({ where: { tokenHash: this.hash(token) }, include: { request: true } });
    if (!recipient) throw new NotFoundException();
    if (recipient.status === 'SIGNED') throw new BadRequestException('Une signature déjà réalisée ne peut pas être refusée.');
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    await this.db.$transaction([
      this.db.signatureRecipient.update({ where: { id: recipient.id }, data: { status: 'REFUSED', refusedAt: new Date(), ipAddress: ip || null, evidence: { reason: dto.reason || null } } }),
      this.db.signatureRequest.update({ where: { id: recipient.requestId }, data: { status: 'REFUSED' } }),
      this.db.auditLog.create({ data: { tenantId: recipient.request.tenantId, action: 'SIGNATURE_REFUSED', entityType: 'SignatureRequest', entityId: recipient.requestId, ipAddress: ip || null, details: { recipientEmail: recipient.email, reason: dto.reason || null } } }),
    ]);
    return { success: true };
  }
}
