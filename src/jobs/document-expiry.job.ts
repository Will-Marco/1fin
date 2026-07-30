import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CronLockService } from '../common/redis/cron-lock.service';
import { CRON_LOCK_TTL_MS } from './cron.constants';

@Injectable()
export class DocumentExpiryJob {
  private readonly logger = new Logger(DocumentExpiryJob.name);

  constructor(
    private prisma: PrismaService,
    private cronLock: CronLockService,
  ) {}

  // Har kuni yarim tunda (00:00). Cluster'da faqat bir instance bajaradi.
  @Cron('0 0 * * *', {
    name: 'document-expiry',
    timeZone: 'Asia/Tashkent',
  })
  async scheduledDocumentExpiry() {
    await this.cronLock.runWithLock(
      'cron:document-expiry',
      CRON_LOCK_TTL_MS,
      () => this.handleDocumentExpiry(),
    );
  }

  async handleDocumentExpiry() {
    this.logger.log('Document expiry checking job started');

    try {
      // Muddati o'tgan PENDING hujjatlarni topish
      const now = new Date();
      const expiredDocuments = await this.prisma.document.findMany({
        where: {
          status: DocumentStatus.PENDING,
          expiresAt: { lt: now },
        },
      });

      if (expiredDocuments.length === 0) {
        this.logger.log('No expired documents found');
        return;
      }

      this.logger.log(`Found ${expiredDocuments.length} expired documents`);

      for (const doc of expiredDocuments) {
        await this.prisma.$transaction(async (tx) => {
          // 1. Statusni yangilash
          await tx.document.update({
            where: { id: doc.id },
            data: { status: DocumentStatus.AUTO_EXPIRED },
          });

          // 2. Action log qo'shish
          await tx.documentActionLog.create({
            data: {
              documentId: doc.id,
              userId: doc.createdById, // Sistema uchun maxsus ID bo'lmasa, yaratuvchini ishlatamiz
              action: 'AUTO_EXPIRED',
              details: {
                message: "Hujjat muddati o'tgani uchun avtomat yopildi",
                expiredAt: doc.expiresAt,
                processedAt: now,
              },
            },
          });
        });

        this.logger.log(
          `Document ${doc.documentNumber} marked as AUTO_EXPIRED`,
        );
      }

      this.logger.log('Document expiry job completed');
    } catch (error) {
      this.logger.error('Document expiry job failed', error);
    }
  }

  // Manual trigger uchun
  async triggerManually() {
    this.logger.log('Manual document expiry check triggered');
    await this.handleDocumentExpiry();
  }
}
