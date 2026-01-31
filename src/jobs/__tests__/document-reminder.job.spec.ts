import { Test, TestingModule } from '@nestjs/testing';
import { DocumentReminderJob } from '../document-reminder.job';
import { PrismaService } from '../../database/prisma.service';
import { NotificationProducer } from '../../queues/producers';
import { DocumentStatus } from '../../../generated/prisma/client';

describe('DocumentReminderJob', () => {
  let job: DocumentReminderJob;

  const mockPrismaService = {
    documentApproval: {
      findMany: jest.fn(),
    },
  };

  const mockNotificationProducer = {
    sendDocumentReminder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentReminderJob,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationProducer, useValue: mockNotificationProducer },
      ],
    }).compile();

    job = module.get<DocumentReminderJob>(DocumentReminderJob);
  });

  describe('handleDocumentReminder', () => {
    it('should send reminders for all pending documents', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          documentName: 'Contract A',
          documentNumber: 'DOC-001',
          status: DocumentStatus.PENDING,
          message: {
            departmentId: 'dept-1',
            department: {
              companyId: 'company-1',
              members: [
                { user: { id: 'user-1' } },
                { user: { id: 'user-2' } },
              ],
            },
          },
        },
        {
          id: 'doc-2',
          documentName: 'Invoice B',
          documentNumber: 'DOC-002',
          status: DocumentStatus.PENDING,
          message: {
            departmentId: 'dept-2',
            department: {
              companyId: 'company-1',
              members: [
                { user: { id: 'user-3' } },
              ],
            },
          },
        },
      ];

      mockPrismaService.documentApproval.findMany.mockResolvedValue(mockDocuments);
      mockNotificationProducer.sendDocumentReminder.mockResolvedValue(undefined);

      await job.handleDocumentReminder();

      expect(mockPrismaService.documentApproval.findMany).toHaveBeenCalledWith({
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

      expect(mockNotificationProducer.sendDocumentReminder).toHaveBeenCalledTimes(2);

      expect(mockNotificationProducer.sendDocumentReminder).toHaveBeenCalledWith({
        userIds: ['user-1', 'user-2'],
        documentId: 'doc-1',
        documentName: 'Contract A',
        documentNumber: 'DOC-001',
        companyId: 'company-1',
        departmentId: 'dept-1',
      });

      expect(mockNotificationProducer.sendDocumentReminder).toHaveBeenCalledWith({
        userIds: ['user-3'],
        documentId: 'doc-2',
        documentName: 'Invoice B',
        documentNumber: 'DOC-002',
        companyId: 'company-1',
        departmentId: 'dept-2',
      });
    });

    it('should not send notification when department has no members', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          documentName: 'Contract A',
          documentNumber: 'DOC-001',
          status: DocumentStatus.PENDING,
          message: {
            departmentId: 'dept-1',
            department: {
              companyId: 'company-1',
              members: [], // No members
            },
          },
        },
      ];

      mockPrismaService.documentApproval.findMany.mockResolvedValue(mockDocuments);

      await job.handleDocumentReminder();

      expect(mockNotificationProducer.sendDocumentReminder).not.toHaveBeenCalled();
    });

    it('should handle empty pending documents', async () => {
      mockPrismaService.documentApproval.findMany.mockResolvedValue([]);

      await job.handleDocumentReminder();

      expect(mockNotificationProducer.sendDocumentReminder).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.documentApproval.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await job.handleDocumentReminder();

      expect(mockNotificationProducer.sendDocumentReminder).not.toHaveBeenCalled();
    });

    it('should handle notification errors without crashing', async () => {
      const mockDocuments = [
        {
          id: 'doc-1',
          documentName: 'Contract A',
          documentNumber: 'DOC-001',
          status: DocumentStatus.PENDING,
          message: {
            departmentId: 'dept-1',
            department: {
              companyId: 'company-1',
              members: [{ user: { id: 'user-1' } }],
            },
          },
        },
      ];

      mockPrismaService.documentApproval.findMany.mockResolvedValue(mockDocuments);
      mockNotificationProducer.sendDocumentReminder.mockRejectedValue(
        new Error('Notification failed'),
      );

      // Should not throw - error is caught by try-catch
      await job.handleDocumentReminder();

      expect(mockNotificationProducer.sendDocumentReminder).toHaveBeenCalledTimes(1);
    });
  });

  describe('triggerManually', () => {
    it('should call handleDocumentReminder', async () => {
      mockPrismaService.documentApproval.findMany.mockResolvedValue([]);

      const handleSpy = jest.spyOn(job, 'handleDocumentReminder');

      await job.triggerManually();

      expect(handleSpy).toHaveBeenCalled();
    });
  });
});
