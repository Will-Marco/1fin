import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { NotificationProducer } from '../queues/producers';

@Injectable()
export class DocumentReminderJob {
  private readonly logger = new Logger(DocumentReminderJob.name);

  constructor(
    private prisma: PrismaService,
    private notificationProducer: NotificationProducer,
  ) {}

  // Har kuni soat 09:00 da ishga tushadi
  @Cron('0 9 * * *', {
    name: 'document-reminder',
    timeZone: 'Asia/Tashkent',
  })
  async handleDocumentReminder() {
    this.logger.log('Document reminder job started');

    try {
      // Barcha PENDING hujjatlarni olish
      const pendingDocuments = await this.prisma.document.findMany({
        where: { status: DocumentStatus.PENDING },
      });

      this.logger.log(`Found ${pendingDocuments.length} pending documents`);

      for (const doc of pendingDocuments) {
        // Ushbu bo'limga kirish huquqi bor aktiv foydalanuvchilarni topish
        const memberships = await this.prisma.userCompanyMembership.findMany({
          where: {
            companyId: doc.companyId,
            isActive: true,
            allowedDepartments: {
              some: { globalDepartmentId: doc.globalDepartmentId },
            },
          },
          select: { userId: true },
        });

        const userIds = memberships.map((m) => m.userId);

        if (userIds.length > 0) {
          await this.notificationProducer.sendDocumentReminder({
            userIds,
            documentId: doc.id,
            documentName: doc.documentName,
            documentNumber: doc.documentNumber,
            companyId: doc.companyId,
            globalDepartmentId: doc.globalDepartmentId,
          });

          this.logger.log(
            `Sent reminder for document ${doc.documentNumber} to ${userIds.length} users`,
          );
        }
      }

      this.logger.log('Document reminder job completed');
    } catch (error) {
      this.logger.error('Document reminder job failed', error);
    }
  }

  // Manual trigger uchun (test yoki admin panel orqali)
  async triggerManually() {
    this.logger.log('Manual document reminder triggered');
    await this.handleDocumentReminder();
  }
}
