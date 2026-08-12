import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

@Injectable()
export class UploadCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(private db: PrismaService, private storage: StorageService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.cleanup().catch((error) => this.logger.error(error)), 15 * 60_000);
    this.timer.unref();
    void this.cleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async cleanup() {
    const limit = new Date(Date.now() - 60 * 60_000);
    const pending = await this.db.document.findMany({
      where: { status: 'PENDING_UPLOAD', createdAt: { lt: limit } },
      select: { id: true, storageKey: true, metadata: true },
      take: 200,
    });
    for (const doc of pending) {
      const meta = (doc.metadata || {}) as any;
      if (meta.uploadId) await this.storage.abortMultipart(doc.storageKey, meta.uploadId).catch(() => undefined);
      await this.storage.delete(doc.storageKey).catch(() => undefined);
    }
    if (pending.length) {
      await this.db.document.deleteMany({ where: { id: { in: pending.map((doc) => doc.id) } } });
      this.logger.log(`${pending.length} import(s) abandonné(s) nettoyé(s)`);
    }
  }
}
