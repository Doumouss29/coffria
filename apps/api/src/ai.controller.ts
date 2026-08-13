import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtGuard } from './jwt.guard';
import { PrismaService } from './prisma.service';
import { ArchiveAiService } from './archive-ai.service';

class ChatDto { @IsString() @MinLength(3) question!: string; }

@Controller('ai')
@UseGuards(JwtGuard)
export class AiController {
  constructor(private db: PrismaService, private ai: ArchiveAiService) {}

  private tenant(req: any) {
    if (!req.user.tenantId) throw new ForbiddenException('Organisation requise');
    return req.user.tenantId;
  }

  private folderWhere(req: any): any {
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

  @Get('status')
  async status(@Req() req: any) {
    const tenantId = this.tenant(req);
    const [documents, chunks] = await Promise.all([
      this.db.document.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE', extractedText: { not: null } } }),
      this.db.archiveChunk.count({ where: { tenantId } }),
    ]);
    return { indexedDocuments: documents, chunks, localProviderConfigured: Boolean(process.env.OLLAMA_BASE_URL) };
  }

  @Post('index/:documentId')
  async index(@Req() req: any, @Param('documentId') documentId: string) {
    const tenantId = this.tenant(req);
    const doc = await this.db.document.findFirst({ where: { id: documentId, tenantId, deletedAt: null, status: 'ACTIVE', folder: this.folderWhere(req) } });
    if (!doc) throw new ForbiddenException('Document inaccessible');
    return this.ai.indexDocument(documentId);
  }

  @Post('index-all')
  async indexAll(@Req() req: any) {
    if (!['TENANT_ADMIN'].includes(req.user.role)) throw new ForbiddenException('Action réservée à l’administrateur');
    const tenantId = this.tenant(req);
    const docs = await this.db.document.findMany({ where: { tenantId, deletedAt: null, status: 'ACTIVE' }, select: { id: true } });
    let indexed = 0;
    for (const doc of docs) {
      const result = await this.ai.indexDocument(doc.id);
      if (result.indexed) indexed++;
    }
    return { success: true, indexed, total: docs.length };
  }

  @Post('chat')
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    const tenantId = this.tenant(req);
    const chunks = await this.db.archiveChunk.findMany({
      where: {
        tenantId,
        document: { deletedAt: null, status: 'ACTIVE', folder: this.folderWhere(req) },
      },
      orderBy: { createdAt: 'desc' },
      take: 1200,
      include: { document: { select: { id: true, name: true, folderId: true } } },
    });
    return this.ai.answer(dto.question.trim(), chunks);
  }
}
