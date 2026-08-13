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
    return req.user.tenantId;
  }
  private canWrite(req: any) {
    if (req.user.role === 'VIEWER') throw new ForbiddenException('Action interdite');
  }
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private appUrl() { return (process.env.APP_URL || 'https://coffria.ci').replace(/\/$/, ''); }

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
      html: `<div style="font-family:Arial,sans-serif;color:#14213d;max-width:650px;margin:auto"><h2>Signature requise dans Coffria</h2><p>Bonjour ${name},</p><p>Le document <strong>${title}</strong> vous attend pour signature.</p>${message ? `<p>${message}</p>` : ''}<p><a href="${link}" style="display:inline-block;background:#d07b35;color:white;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Consulter et signer</a></p><p style="color:#7a8494;font-size:12px">Ce lien est personnel. Ne le transmettez pas.</p></div>`,
    });
  }

  @Get()
  @UseGuards(JwtGuard)
  async list(@Req() req: any) {
    const tenantId = this.tenant(req);
    return this.db.signatureRequest.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' },
      include: { sourceDocument: { select: { id: true, name: true } }, finalDocument: { select: { id: true, name: true } }, recipients: { orderBy: { order: 'asc' } } },
    });
  }

  @Post()
  @UseGuards(JwtGuard)
  async create(@Req() req: any, @Body() dto: CreateSignatureDto) {
    this.canWrite(req);
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id: dto.documentId, tenantId, deletedAt: null, status: 'ACTIVE' } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if ((doc.extension || '').toLowerCase() !== 'pdf') throw new BadRequestException('La signature Coffria est disponible sur les documents PDF.');
    if (!dto.recipients?.length) throw new BadRequestException('Ajoutez au moins un signataire.');

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
    const request = await this.db.signatureRequest.findFirst({ where: { id, tenantId: this.tenant(req) }, include: { sourceDocument: true, finalDocument: true, recipients: { orderBy: { order: 'asc' } } } });
    if (!request) throw new NotFoundException('Demande introuvable');
    return request;
  }

  @Post(':id/cancel')
  @UseGuards(JwtGuard)
  async cancel(@Req() req: any, @Param('id') id: string) {
    const request = await this.db.signatureRequest.findFirst({ where: { id, tenantId: this.tenant(req) } });
    if (!request) throw new NotFoundException();
    if (request.createdById !== req.user.sub && req.user.role !== 'TENANT_ADMIN') throw new ForbiddenException();
    return this.db.signatureRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  @Get('public/:token')
  async publicDetail(@Param('token') token: string) {
    const recipient = await this.db.signatureRecipient.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { request: { include: { sourceDocument: { select: { name: true } }, recipients: { orderBy: { order: 'asc' }, select: { name: true, email: true, order: true, status: true, signedAt: true } } } } },
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
    return {
      waiting: false,
      recipient: { name: recipient.name, email: recipient.email, status: recipient.status },
      request: { title: request.title, message: request.message, documentName: request.sourceDocument.name, status: request.status, recipients: request.recipients },
      documentUrl: await this.storage.downloadUrl(request.currentStorageKey, 'inline'),
    };
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

    const input = await this.storage.readBuffer(request.currentStorageKey);
    const pdf = await PDFDocument.load(input);
    const page = pdf.getPages()[pdf.getPageCount() - 1];
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const width = page.getWidth();
    const y = 34 + ((recipient.order - 1) % 4) * 45;
    page.drawRectangle({ x: 28, y: y - 8, width: Math.min(width - 56, 530), height: 40, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.08, 0.13, 0.24), borderWidth: 0.6 });
    page.drawText(`Signature Coffria #${recipient.order} — ${dto.signatureText.trim()}`, { x: 38, y: y + 16, size: 10, font: bold, color: rgb(0.08, 0.13, 0.24) });
    page.drawText(`${recipient.name} <${recipient.email}> — ${new Date().toISOString()}`, { x: 38, y: y + 3, size: 7.5, font, color: rgb(0.35, 0.39, 0.48) });
    const bytes = Buffer.from(await pdf.save());
    const signedKey = `tenants/${request.tenantId}/signatures/${request.id}/${recipient.order}-${randomUUID()}.pdf`;
    await this.storage.putBuffer(signedKey, bytes, 'application/pdf');

    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const userAgent = String(req.headers['user-agent'] || '');
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
        name: finalName, extension: 'pdf', mimeType: 'application/pdf', sizeBytes: BigInt(bytes.length), storageKey: finalKey, status: 'ACTIVE', createdById: request.createdById,
        metadata: { signedByCoffria: true, signatureRequestId: request.id },
      } });
      finalDocumentId = finalDoc.id;
    }

    await this.db.$transaction([
      this.db.signatureRecipient.update({ where: { id: recipient.id }, data: { status: 'SIGNED', signedAt: new Date(), signatureText: dto.signatureText.trim(), ipAddress: ip || null, userAgent: userAgent || null, evidence: { tokenHash: recipient.tokenHash, signedAt: new Date().toISOString() } } }),
      this.db.signatureRequest.update({ where: { id: request.id }, data: { currentStorageKey: signedKey, status: isFinal ? 'COMPLETED' : 'PARTIALLY_SIGNED', completedAt: isFinal ? new Date() : null, finalDocumentId: finalDocumentId || null } }),
      this.db.auditLog.create({ data: { tenantId: request.tenantId, action: 'DOCUMENT_SIGNED', entityType: 'SignatureRequest', entityId: request.id, ipAddress: ip || null, userAgent: userAgent || null, details: { recipientEmail: recipient.email, order: recipient.order } } }),
    ]);

    if (next) {
      // Le jeton brut n'est pas stocké : on génère un nouveau jeton pour le prochain signataire et remplace son hash.
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
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    await this.db.$transaction([
      this.db.signatureRecipient.update({ where: { id: recipient.id }, data: { status: 'REFUSED', refusedAt: new Date(), ipAddress: ip || null, evidence: { reason: dto.reason || null } } }),
      this.db.signatureRequest.update({ where: { id: recipient.requestId }, data: { status: 'REFUSED' } }),
    ]);
    return { success: true };
  }
}
