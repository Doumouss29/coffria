import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class ArchiveAiService {
  constructor(private db: PrismaService, private storage: StorageService) {}

  private ollamaBase() { return (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, ''); }
  private embedModel() { return process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text'; }
  private chatModel() { return process.env.OLLAMA_CHAT_MODEL || 'qwen2.5:1.5b'; }

  private async embed(text: string): Promise<number[] | null> {
    const base = this.ollamaBase();
    if (!base) return null;
    try {
      const response = await fetch(`${base}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel(), input: text }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) return null;
      const json: any = await response.json();
      return Array.isArray(json.embeddings?.[0]) ? json.embeddings[0] : null;
    } catch {
      return null;
    }
  }

  private chunks(text: string, page?: number | null) {
    const normalized = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const out: Array<{ content: string; page: number | null }> = [];
    const size = 1600;
    const overlap = 250;
    for (let start = 0; start < normalized.length; start += size - overlap) {
      const content = normalized.slice(start, start + size).trim();
      if (content.length >= 60) out.push({ content, page: page ?? null });
    }
    return out;
  }

  private async extractPdf(buffer: Buffer) {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
    const pages: Array<{ page: number; text: string }> = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str || '').join(' ');
      pages.push({ page: p, text });
    }
    return pages;
  }

  private async extract(document: { extension: string | null; mimeType: string; storageKey: string }) {
    const ext = (document.extension || '').toLowerCase();
    const buffer = await this.storage.readBuffer(document.storageKey);
    if (ext === 'pdf' || document.mimeType === 'application/pdf') return this.extractPdf(buffer);
    if (['txt', 'csv', 'json', 'xml', 'md', 'dxf'].includes(ext)) return [{ page: 1, text: buffer.toString('utf8') }];
    if (ext === 'docx') {
      const mammoth: any = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return [{ page: 1, text: result.value || '' }];
    }
    if (['xlsx', 'xls'].includes(ext)) {
      const XLSX: any = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const text = workbook.SheetNames.map((name: string) => `Feuille: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join('\n\n');
      return [{ page: 1, text }];
    }
    return [];
  }

  async indexDocument(documentId: string) {
    const document = await this.db.document.findUnique({ where: { id: documentId } });
    if (!document || document.status !== 'ACTIVE' || document.deletedAt) return { indexed: false, reason: 'document-unavailable' };
    const pages = await this.extract(document).catch(() => []);
    if (!pages.length) return { indexed: false, reason: 'unsupported-format' };
    const records: Array<{ tenantId: string; documentId: string; page: number | null; position: number; content: string; embedding: any }> = [];
    let position = 0;
    for (const page of pages) {
      for (const chunk of this.chunks(page.text, page.page)) {
        records.push({ tenantId: document.tenantId, documentId: document.id, page: chunk.page, position: position++, content: chunk.content, embedding: await this.embed(chunk.content) as any });
      }
    }
    await this.db.$transaction(async (tx) => {
      await tx.archiveChunk.deleteMany({ where: { documentId } });
      for (const record of records) await tx.archiveChunk.create({ data: record });
      await tx.document.update({ where: { id: documentId }, data: { extractedText: pages.map((p) => p.text).join('\n\n').slice(0, 2_000_000) } });
    });
    return { indexed: true, chunks: records.length };
  }

  private cosine(a: number[], b: number[]) {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return dot / ((Math.sqrt(aa) * Math.sqrt(bb)) || 1);
  }

  private keywordScore(question: string, content: string) {
    const tokens = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((x) => x.length > 2);
    const hay = content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return tokens.reduce((score, token) => score + (hay.includes(token) ? 1 : 0), 0) / Math.max(1, tokens.length);
  }

  async answer(question: string, chunks: any[]) {
    const qEmbedding = await this.embed(question);
    const ranked = chunks.map((chunk) => {
      const embedding = Array.isArray(chunk.embedding) ? chunk.embedding as number[] : [];
      const semantic = qEmbedding && embedding.length ? this.cosine(qEmbedding, embedding) : 0;
      const lexical = this.keywordScore(question, chunk.content);
      return { ...chunk, score: semantic * 0.72 + lexical * 0.28 };
    }).sort((a, b) => b.score - a.score).slice(0, 8);

    const citations = ranked.map((r, i) => ({ index: i + 1, documentId: r.documentId, documentName: r.document.name, page: r.page, excerpt: r.content.slice(0, 420) }));
    const context = ranked.map((r, i) => `[${i + 1}] ${r.document.name}${r.page ? ` — page ${r.page}` : ''}\n${r.content}`).join('\n\n');
    const base = this.ollamaBase();
    if (!base) return { answer: 'Le moteur IA local n’est pas encore démarré. Les passages les plus pertinents sont disponibles dans les sources ci-dessous.', citations, localAiAvailable: false };

    try {
      const response = await fetch(`${base}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.chatModel(), stream: false,
          messages: [
            { role: 'system', content: "Tu es l’assistant documentaire Coffria. Réponds uniquement avec les informations présentes dans les sources. Cite chaque affirmation importante avec [n]. Si les sources ne suffisent pas, dis-le clairement. Réponds en français." },
            { role: 'user', content: `Question: ${question}\n\nSources:\n${context}` },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error('ollama');
      const json: any = await response.json();
      return { answer: json.message?.content || 'Aucune réponse générée.', citations, localAiAvailable: true };
    } catch {
      return { answer: 'Le moteur IA local est temporairement indisponible. Voici les passages les plus pertinents trouvés dans vos archives.', citations, localAiAvailable: false };
    }
  }
}
