import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { StorageService } from './storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class CadConversionService {
  constructor(private storage: StorageService) {}

  async dwgToDxf(document: { id: string; storageKey: string }) {
    const previewKey = `previews/documents/${document.id}/preview.dxf`;
    try {
      await this.storage.head(previewKey);
      return previewKey;
    } catch {
      // Génération à la première ouverture.
    }

    const dir = await mkdtemp(join(tmpdir(), 'coffria-dwg-'));
    try {
      const inputPath = join(dir, 'source.dwg');
      await writeFile(inputPath, await this.storage.readBuffer(document.storageKey));
      await execFileAsync('dwg2dxf', ['-y', inputPath], { cwd: dir, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
      const files = await readdir(dir);
      const output = files.find((name) => name.toLowerCase().endsWith('.dxf'));
      if (!output) throw new Error('Le convertisseur DWG n’a produit aucun DXF.');
      const dxf = await readFile(join(dir, output));
      await this.storage.putBuffer(previewKey, dxf, 'application/dxf');
      return previewKey;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
