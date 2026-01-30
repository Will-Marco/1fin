import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { NotificationProducer } from '../queues/producers';
import { DocumentStatus } from '../../generated/prisma/client';

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
      const pendingDocuments = await this.prisma.documentApproval.findMany({
        where: { status: DocumentStatus.PENDING },
        include: {
          message: {
            include: {
              department: {
                include: {
                  members: {
                    include: {
                      user: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      this.logger.log(`Found ${pendingDocuments.length} pending documents`);

      // Har bir hujjat uchun notification yuborish
      for (const doc of pendingDocuments) {
        const departmentMembers = doc.message.department.members;
        const userIds = departmentMembers.map((m) => m.user.id);

        if (userIds.length > 0) {
          await this.notificationProducer.sendDocumentReminder({
            userIds,
            documentId: doc.id,
            documentName: doc.documentName,
            documentNumber: doc.documentNumber,
            companyId: doc.message.department.companyId,
            departmentId: doc.message.departmentId,
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
