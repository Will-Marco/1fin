import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ArchiveService } from '../modules/archive/archive.service';

@Injectable()
export class ArchiveJob {
  private readonly logger = new Logger(ArchiveJob.name);

  constructor(private archiveService: ArchiveService) {}

  // Har kuni kechqurun soat 02:00 da ishga tushadi (kam traffic vaqtda)
  @Cron('0 2 * * *', {
    name: 'archive-old-data',
    timeZone: 'Asia/Tashkent',
  })
  async handleArchive() {
    this.logger.log('Archive job started');

    try {
      // Eski xabarlarni arxivlash
      const messageResult = await this.archiveService.archiveOldMessages();

      this.logger.log(
        `Archived: ${messageResult.messagesArchived} messages, ${messageResult.filesArchived} files, ${messageResult.documentApprovalsArchived} document approvals`,
      );
      this.logger.log(
        `Deleted: ${messageResult.messageEditsDeleted} edits, ${messageResult.messageForwardsDeleted} forwards`,
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
