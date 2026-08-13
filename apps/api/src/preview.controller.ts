import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Controller('preview')
@UseGuards(JwtGuard)
export class PreviewController {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private tenant(req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId as string;
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

  @Get(':id')
  async preview(@Req() req: any, @Param('id') id: string) {
    const doc = await this.db.document.findFirst({
      where: { id, tenantId: this.tenant(req), deletedAt: null, status: 'ACTIVE', folder: this.accessWhere(req) },
      select: { id: true, name: true, extension: true, mimeType: true, sizeBytes: true, storageKey: true, extractedText: true },
    });
    if (!doc) throw new NotFoundException('Document introuvable');
    const ext = (doc.extension || '').toLowerCase();
    const common = { id: doc.id, name: doc.name, extension: ext, mimeType: doc.mimeType, sizeBytes: String(doc.sizeBytes) };
    if (ext === 'pdf' || doc.mimeType === 'application/pdf') return { ...common, kind: 'pdf', url: await this.storage.downloadUrl(doc.storageKey, 'inline') };
    if (doc.mimeType.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return { ...common, kind: 'image', url: await this.storage.downloadUrl(doc.storageKey, 'inline') };
    if (ext === 'dxf') return { ...common, kind: 'dxf', url: await this.storage.downloadUrl(doc.storageKey, 'inline') };
    if (ext === 'dwg') return { ...common, kind: 'dwg', url: await this.storage.downloadUrl(doc.storageKey, 'attachment'), message: 'Le DWG binaire nécessite une conversion locale DWG → DXF avant rendu. Le pipeline Coffria est prêt à recevoir ce convertisseur sans service SaaS.' };
    if (['txt','csv','json','xml','md','log'].includes(ext)) {
      const buffer = await this.storage.readBuffer(doc.storageKey);
      return { ...common, kind: 'text', text: buffer.subarray(0, 5 * 1024 * 1024).toString('utf8') };
    }
    if (['docx','doc','xlsx','xls','pptx','ppt','odt','ods','odp'].includes(ext)) {
      return { ...common, kind: 'office', text: doc.extractedText || null, downloadUrl: await this.storage.downloadUrl(doc.storageKey, 'attachment'), indexed: Boolean(doc.extractedText) };
    }
    return { ...common, kind: 'generic', downloadUrl: await this.storage.downloadUrl(doc.storageKey, 'attachment') };
  }
}
