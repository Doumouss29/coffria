import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { promisify } from 'util';
import { StorageService } from './storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class DocumentConversionService {
  constructor(private storage: StorageService) {}

  private safeName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'document';
  }

  async officeToPdf(document: { id: string; name: string; storageKey: string }) {
    const previewKey = `previews/documents/${document.id}/preview.pdf`;
    try {
      await this.storage.head(previewKey);
      return previewKey;
    } catch {
      // Première génération du cache de prévisualisation.
    }

    const dir = await mkdtemp(join(tmpdir(), 'coffria-office-'));
    try {
      const ext = extname(document.name) || '.bin';
      const inputName = this.safeName(basename(document.name, ext)) + ext.toLowerCase();
      const inputPath = join(dir, inputName);
      await writeFile(inputPath, await this.storage.readBuffer(document.storageKey));
      await execFileAsync('libreoffice', [
        '--headless', '--nologo', '--nodefault', '--nolockcheck', '--nofirststartwizard',
        '--convert-to', 'pdf', '--outdir', dir, inputPath,
      ], { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 });
      const outputPath = join(dir, `${basename(inputName, ext)}.pdf`);
      const pdf = await readFile(outputPath);
      await this.storage.putBuffer(previewKey, pdf, 'application/pdf');
      return previewKey;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
