import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DocumentExpiryJob {
  private readonly logger = new Logger(DocumentExpiryJob.name);

  constructor(private prisma: PrismaService) {}

  // Har kuni yarim tunda ishga tushadi (00:00)
  @Cron('0 0 * * *', {
    name: 'document-expiry',
    timeZone: 'Asia/Tashkent',
  })
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
                message: 'Hujjat muddati o\'tgani uchun avtomat yopildi',
                expiredAt: doc.expiresAt,
                processedAt: now,
              },
            },
          });
        });

        this.logger.log(`Document ${doc.documentNumber} marked as AUTO_EXPIRED`);
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
