import { BadRequestException, Body, Controller, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

class DirectSignDto {
  @IsString() @MinLength(2) signatureText!: string;
  @IsString() @MinLength(20) signatureImage!: string;
  @IsString() @MinLength(20) signatureOverlay!: string;
  @Type(() => Number) @IsInt() @Min(1) pageNumber!: number;
}

@Controller('signatures/public')
export class DirectSignatureController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private appUrl() {
    const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL?.split(',')[0] || 'https://coffria.ci';
    return configured.trim().replace(/\/$/, '');
  }
  private escape(value: string) { return value.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c)); }
  private decodePng(dataUrl: string, maxBytes: number, label: string) {
    const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new BadRequestException(`${label} doit être une image PNG valide.`);
    const bytes = Buffer.from(match[1], 'base64');
    if (!bytes.length || bytes.length > maxBytes) throw new BadRequestException(`${label} est vide ou trop volumineuse.`);
    return bytes;
  }
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

  @Post(':token/sign-direct')
  async signDirect(@Req() req: any, @Param('token') token: string, @Body() dto: DirectSignDto) {
    const recipient = await this.db.signatureRecipient.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { request: { include: { sourceDocument: true, recipients: { orderBy: { order: 'asc' } } } } },
    });
    if (!recipient) throw new NotFoundException('Lien invalide');
    if (recipient.status === 'SIGNED') throw new BadRequestException('Vous avez déjà signé ce document.');
    const request = recipient.request;
    if (!['PENDING', 'PARTIALLY_SIGNED'].includes(request.status)) throw new BadRequestException('Cette demande n’est plus signable.');
    if (request.expiresAt && request.expiresAt < new Date()) throw new BadRequestException('Cette demande a expiré.');
    if (request.recipients.some((r: any) => r.order < recipient.order && r.status !== 'SIGNED')) throw new BadRequestException('Le document attend encore une signature précédente.');

    const signatureBytes = this.decodePng(dto.signatureImage, 500_000, 'La signature graphique');
    const overlayBytes = this.decodePng(dto.signatureOverlay, 2_500_000, 'Le tracé sur le document');
    const signedAt = new Date();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const userAgent = String(req.headers['user-agent'] || '');

    const input = await this.storage.readBuffer(request.currentStorageKey);
    const pdf = await PDFDocument.load(input);
    const pages = pdf.getPages();
    if (!pages.length) throw new BadRequestException('Le PDF ne contient aucune page.');
    if (dto.pageNumber > pages.length) throw new BadRequestException('La page sélectionnée n’existe pas dans le document.');

    const targetPage = pages[dto.pageNumber - 1];
    const overlayPng = await pdf.embedPng(overlayBytes);
    const { width: pageWidth, height: pageHeight } = targetPage.getSize();
    targetPage.drawImage(overlayPng, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    const signaturePng = await pdf.embedPng(signatureBytes);
    const rawSize = signaturePng.scale(1);
    const proof = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    proof.drawText('COFFRIA — PREUVE DE SIGNATURE', { x: 48, y: 770, size: 18, font: bold, color: rgb(0.08, 0.13, 0.24) });
    proof.drawText(`Circuit : ${request.title}`, { x: 48, y: 735, size: 11, font, color: rgb(0.25, 0.3, 0.4) });
    proof.drawRectangle({ x: 48, y: 545, width: 499, height: 150, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 1 });
    proof.drawText(`Signature Coffria #${recipient.order}`, { x: 68, y: 665, size: 13, font: bold, color: rgb(0.08, 0.13, 0.24) });
    const proofWidth = 150;
    const proofHeight = Math.min(58, proofWidth * (rawSize.height / rawSize.width));
    proof.drawImage(signaturePng, { x: 68, y: 595, width: proofWidth, height: proofHeight });
    proof.drawText(`Identité déclarée : ${recipient.name} <${recipient.email}>`, { x: 68, y: 575, size: 9, font });
    proof.drawText(`Date UTC : ${signedAt.toISOString()}`, { x: 68, y: 558, size: 9, font });
    proof.drawText(`Signature manuscrite directe : page ${dto.pageNumber}`, { x: 48, y: 515, size: 8, font, color: rgb(0.35, 0.39, 0.48) });
    proof.drawText(`Adresse IP : ${ip || 'non disponible'}`, { x: 48, y: 495, size: 8, font, color: rgb(0.35, 0.39, 0.48) });
    proof.drawText('Le tracé a été dessiné directement sur la page affichée puis fusionné avec le PDF aux mêmes coordonnées relatives.', { x: 48, y: 455, size: 8, font, color: rgb(0.35, 0.39, 0.48), maxWidth: 490, lineHeight: 12 });

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
        id, tenantId: request.tenantId, folderId: request.sourceDocument.folderId,
        technicalNumber: `COF-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`,
        name: finalName, extension: 'pdf', mimeType: 'application/pdf', sizeBytes: BigInt(bytes.length), storageKey: finalKey,
        checksumSha256: digest, status: 'ACTIVE', createdById: request.createdById,
        metadata: { signedByCoffria: true, signatureRequestId: request.id, completedAt: signedAt.toISOString(), signatureMode: 'DIRECT_PAGE_INK' },
      } });
      finalDocumentId = finalDoc.id;
    }

    await this.db.$transaction([
      this.db.signatureRecipient.update({ where: { id: recipient.id }, data: {
        status: 'SIGNED', signedAt, signatureText: dto.signatureText.trim(), ipAddress: ip || null, userAgent: userAgent || null,
        evidence: { tokenHash: recipient.tokenHash, signedAt: signedAt.toISOString(), sha256: digest, signatureType: 'DIRECT_PAGE_INK', pageNumber: dto.pageNumber },
      } }),
      this.db.signatureRequest.update({ where: { id: request.id }, data: {
        currentStorageKey: signedKey, status: isFinal ? 'COMPLETED' : 'PARTIALLY_SIGNED', completedAt: isFinal ? signedAt : null, finalDocumentId: finalDocumentId || null,
      } }),
      this.db.auditLog.create({ data: {
        tenantId: request.tenantId, action: 'DOCUMENT_SIGNED', entityType: 'SignatureRequest', entityId: request.id,
        ipAddress: ip || null, userAgent: userAgent || null,
        details: { recipientEmail: recipient.email, order: recipient.order, sha256: digest, signatureType: 'DIRECT_PAGE_INK', pageNumber: dto.pageNumber },
      } }),
    ]);

    if (next) {
      const nextToken = randomBytes(32).toString('hex');
      await this.db.signatureRecipient.update({ where: { id: next.id }, data: { tokenHash: this.hash(nextToken) } });
      await this.sendInvitation(next.email, next.name, request.title, nextToken, request.message).catch((e) => console.error('Signature invitation email error', e));
    }
    return { success: true, completed: isFinal, finalDocumentId };
  }
}
