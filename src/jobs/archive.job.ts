import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ArchiveService } from '../modules/archive/archive.service';
import { CronLockService } from '../common/redis/cron-lock.service';
import { CRON_LOCK_TTL_MS } from './cron.constants';

@Injectable()
export class ArchiveJob {
  private readonly logger = new Logger(ArchiveJob.name);

  constructor(
    private archiveService: ArchiveService,
    private cronLock: CronLockService,
  ) {}

  // Har kuni kechqurun soat 02:00 da (kam traffic). Cluster'da faqat bir instance.
  @Cron('0 2 * * *', {
    name: 'archive-old-data',
    timeZone: 'Asia/Tashkent',
  })
  async scheduledArchive() {
    await this.cronLock.runWithLock('cron:archive-old-data', CRON_LOCK_TTL_MS, () =>
      this.handleArchive(),
    );
  }

  async handleArchive() {
    this.logger.log('Archive job started');

    try {
      // Eski xabarlar va hujjatlarni arxivlash
      const archiveResult = await this.archiveService.archiveOldData();

      this.logger.log(
        `Archived: ${archiveResult.messagesArchived} messages, ${archiveResult.documentsArchived} documents, ${archiveResult.filesArchived} files`,
      );
      this.logger.log(
        `Deleted: ${archiveResult.messageEditsDeleted} edits, ${archiveResult.messageForwardsDeleted} forwards`,
      );

      // Xabarga bog'lanmagan eski fayllarni arxivlash
      const orphanFilesCount = await this.archiveService.archiveOrphanFiles();
      this.logger.log(`Archived ${orphanFilesCount} orphan files`);

      this.logger.log('Archive job completed');
    } catch (error) {
      this.logger.error('Archive job failed', error);
    }
  }

  // Manual trigger uchun (test yoki admin panel orqali)
  async triggerManually() {
    this.logger.log('Manual archive triggered');
    await this.handleArchive();
  }
}
