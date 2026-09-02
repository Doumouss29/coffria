import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ArchiveAiService } from './archive-ai.service';

@Injectable()
export class SearchService {
  constructor(private db: PrismaService, private ai: ArchiveAiService) {}

  private normalize(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private variants(value: string) {
    const clean = value.trim().replace(/[?.!,;:]+$/g, '').trim();
    if (!clean) return [];

    const out = new Set<string>([clean]);
    const parts = clean.split(/\s+/);
    const last = parts[parts.length - 1];

    if (last.length > 3) {
      const singularOrPlural = [...parts];
      if (last.toLowerCase().endsWith('s')) {
        singularOrPlural[singularOrPlural.length - 1] = last.slice(0, -1);
      } else {
        singularOrPlural[singularOrPlural.length - 1] = `${last}s`;
      }
      out.add(singularOrPlural.join(' '));
    }

    return [...out];
  }

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

  private folderAccess(user: any) {
    if (user.role === 'TENANT_ADMIN') return undefined;

    return {
      OR: [
        { visibility: 'COMPANY' },
        { createdById: user.sub },
        { userAccesses: { some: { userId: user.sub } } },
        {
          groupAccesses: {
            some: {
              group: {
                members: {
                  some: { userId: user.sub },
                },
              },
            },
          },
        },
      ],
    };
  }

  private buildWhere(user: any, q: string, f: any) {
    const where: any = {
      tenantId: user.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
    };

    const folder = this.folderAccess(user);
    if (folder) where.folder = folder;
    if (f.extension) where.extension = f.extension;
    if (f.minBytes) where.sizeBytes = { gte: BigInt(f.minBytes) };

    const ors: any[] = [];
    if (f.nameContains) ors.push({ name: { contains: f.nameContains, mode: 'insensitive' } });
    if (f.nameStartsWith) ors.push({ name: { startsWith: f.nameStartsWith, mode: 'insensitive' } });
    if (f.nameEndsWith) ors.push({ name: { endsWith: f.nameEndsWith, mode: 'insensitive' } });

    const term = f.contentContains || (!ors.length ? q.trim() : '');
    if (term) {
      for (const variant of this.variants(term)) {
        ors.push(
          { name: { contains: variant, mode: 'insensitive' } },
          { extractedText: { contains: variant, mode: 'insensitive' } },
        );
      }
    }

    if (ors.length) where.OR = ors;
    return where;
  }

  private async find(user: any, q: string, f: any, sort: string) {
    return this.db.document.findMany({
      where: this.buildWhere(user, q, f),
      take: 100,
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : { name: 'asc' },
      include: {
        folder: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });
  }

  private async indexMissingAccessibleDocuments(user: any) {
    const where: any = {
      tenantId: user.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      extractedText: null,
      extension: {
        in: ['pdf', 'txt', 'csv', 'json', 'xml', 'md', 'dxf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp'],
      },
    };

    const folder = this.folderAccess(user);
    if (folder) where.folder = folder;

    const missing = await this.db.document.findMany({
      where,
      select: { id: true },
      take: 12,
      orderBy: { createdAt: 'desc' },
    });

    if (!missing.length) return 0;

    await Promise.allSettled(
      missing.map((document) => this.ai.indexDocument(document.id)),
    );

    return missing.length;
  }

  async run(user: any, q: string, sort = 'relevance') {
    const f = this.parse(q);
    let docs = await this.find(user, q, f, sort);

    if (!docs.length && q.trim()) {
      const indexed = await this.indexMissingAccessibleDocuments(user);
      if (indexed) docs = await this.find(user, q, f, sort);
    }

    return {
      query: q,
      normalizedQuery: this.normalize(q),
      interpretedFilters: f,
      documents: docs,
    };
  }
}
