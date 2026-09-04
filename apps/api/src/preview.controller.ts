import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';
import { DocumentConversionService } from './document-conversion.service';

@Controller('preview')
@UseGuards(JwtGuard)
export class PreviewController {
  constructor(
    private db: PrismaService,
    private storage: StorageService,
    private conversion: DocumentConversionService,
  ) {}

  private tenant(req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
  }

  private companyAccessWhere(req: any): any {
    if (req.user.role === 'TENANT_ADMIN') return { space: 'COMPANY' };
    return {
      space: 'COMPANY',
      OR: [
        { visibility: 'COMPANY' },
        { createdById: req.user.sub },
        { userAccesses: { some: { userId: req.user.sub } } },
        { groupAccesses: { some: { group: { members: { some: { userId: req.user.sub } } } } } },
      ],
    };
  }

  @Get(':id')
  async preview(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({
      where: { id, tenantId, deletedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        extension: true,
        mimeType: true,
        sizeBytes: true,
        storageKey: true,
        extractedText: true,
        folder: { select: { id: true, space: true, createdById: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document introuvable');

    if (doc.folder.space === 'PERSONAL') {
      if (doc.folder.createdById !== req.user.sub) throw new ForbiddenException('Document personnel non autorisé');
    } else {
      const allowed = await this.db.folder.count({ where: { id: doc.folder.id, tenantId, deletedAt: null, ...this.companyAccessWhere(req) } });
      if (!allowed) throw new ForbiddenException('Document non autorisé');
      await this.db.auditLog.create({
        data: {
          tenantId,
          userId: req.user.sub,
          action: 'DOCUMENT_OPENED',
          entityType: 'Document',
          entityId: doc.id,
          userAgent: req.headers?.['user-agent'] || null,
        },
      });
    }

    const ext = (doc.extension || '').toLowerCase();
    const common = { id: doc.id, name: doc.name, extension: ext, mimeType: doc.mimeType, sizeBytes: String(doc.sizeBytes) };

    if (ext === 'pdf' || doc.mimeType === 'application/pdf') return { ...common, kind: 'pdf', url: await this.storage.downloadUrl(doc.storageKey, 'inline') };
    if (doc.mimeType.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return { ...common, kind: 'image', url: await this.storage.downloadUrl(doc.storageKey, 'inline') };
    if (['txt','csv','json','xml','md','log'].includes(ext)) {
      const buffer = await this.storage.readBuffer(doc.storageKey);
      return { ...common, kind: 'text', text: buffer.subarray(0, 5 * 1024 * 1024).toString('utf8') };
    }
    if (['docx','doc','xlsx','xls','pptx','ppt','odt','ods','odp'].includes(ext)) {
      try {
        const previewKey = await this.conversion.officeToPdf(doc);
        return { ...common, kind: 'pdf', office: true, url: await this.storage.downloadUrl(previewKey, 'inline'), downloadUrl: true };
      } catch (error) {
        console.error('Office preview conversion error', error);
        return { ...common, kind: 'office', text: doc.extractedText || null, downloadUrl: true, indexed: Boolean(doc.extractedText) };
      }
    }
    return { ...common, kind: 'generic', downloadUrl: true };
  }
}
