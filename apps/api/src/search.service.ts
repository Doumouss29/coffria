import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class SearchService {
  constructor(private db: PrismaService) {}

  parse(q: string) {
    const s = q.trim();
    const f: any = {};
    let m: RegExpMatchArray | null;

    if ((m = s.match(/nom (?:contient|contenant) ["']?([^"']+)["']?/i))) f.nameContains = m[1].trim();
    if ((m = s.match(/(?:commence|début) par ["']?([^"']+)["']?/i))) f.nameStartsWith = m[1].trim();
    if ((m = s.match(/(?:se termine|finit) par ["']?([^"']+)["']?/i))) f.nameEndsWith = m[1].trim();
    if ((m = s.match(/\b(pdf|docx?|xlsx?|pptx?|zip|jpg|jpeg|png|tiff?|dwg|dxf|txt|csv)\b/i))) f.extension = m[1].toLowerCase();
    if ((m = s.match(/(?:plus de|supérieur à)\s*(\d+)\s*(ko|mo|go)/i))) {
      const n = Number(m[1]);
      const u = m[2].toLowerCase();
      f.minBytes = n * (u === 'go' ? 1073741824 : u === 'mo' ? 1048576 : 1024);
    }

    // Requêtes naturelles portant sur le contenu du document.
    // Exemples : "documents contenant parcelle", "document concernant parcelle",
    // "documents qui parlent de bornage", "documents avec le mot contrat".
    const contentPatterns = [
      /(?:documents?|fichiers?)\s+(?:qui\s+)?(?:contiennent?|contenant|concernent?|concernant)\s+(?:le\s+mot\s+)?["']?(.+?)["']?$/i,
      /(?:documents?|fichiers?)\s+(?:qui\s+)?(?:parlent?|traitent?)\s+(?:de|du|des)\s+["']?(.+?)["']?$/i,
      /(?:documents?|fichiers?)\s+(?:avec|ayant)\s+(?:le\s+mot|les\s+mots|le\s+terme|les\s+termes)\s+["']?(.+?)["']?$/i,
      /(?:recherche(?:r)?|trouve(?:r)?|affiche(?:r)?)\s+(?:les?\s+)?(?:documents?|fichiers?)\s+(?:qui\s+)?(?:contiennent?|contenant|concernent?|concernant)\s+["']?(.+?)["']?$/i,
    ];
    for (const pattern of contentPatterns) {
      const match = s.match(pattern);
      if (match?.[1]?.trim()) {
        f.contentContains = match[1].trim().replace(/[?.!,;:]+$/g, '').trim();
        break;
      }
    }

    return f;
  }

  async run(user: any, q: string, sort = 'relevance') {
    const tenantId = user.tenantId;
    const f = this.parse(q);
    const where: any = { tenantId, deletedAt: null, status: 'ACTIVE' };

    if (user.role !== 'TENANT_ADMIN') {
      where.folder = {
        OR: [
          { visibility: 'COMPANY' },
          { createdById: user.sub },
          { userAccesses: { some: { userId: user.sub } } },
          { groupAccesses: { some: { group: { members: { some: { userId: user.sub } } } } } },
        ],
      };
    }

    if (f.extension) where.extension = f.extension;
    if (f.minBytes) where.sizeBytes = { gte: BigInt(f.minBytes) };

    const ors: any[] = [];
    if (f.nameContains) ors.push({ name: { contains: f.nameContains, mode: 'insensitive' } });
    if (f.nameStartsWith) ors.push({ name: { startsWith: f.nameStartsWith, mode: 'insensitive' } });
    if (f.nameEndsWith) ors.push({ name: { endsWith: f.nameEndsWith, mode: 'insensitive' } });

    if (f.contentContains) {
      // Une recherche "document contenant X" doit trouver X aussi bien dans le nom
      // que dans le texte extrait du document.
      ors.push(
        { name: { contains: f.contentContains, mode: 'insensitive' } },
        { extractedText: { contains: f.contentContains, mode: 'insensitive' } },
      );
    }

    if (!ors.length && q.trim()) {
      ors.push(
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { extractedText: { contains: q.trim(), mode: 'insensitive' } },
      );
    }
    if (ors.length) where.OR = ors;

    const docs = await this.db.document.findMany({
      where,
      take: 100,
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { name: 'asc' },
      include: { folder: { select: { name: true } }, createdBy: { select: { name: true } } },
    });

    return { query: q, interpretedFilters: f, documents: docs };
  }
}
