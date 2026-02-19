import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationProducer } from '../../queues/producers';
import { DocumentReminderJob } from '../document-reminder.job';

describe('DocumentReminderJob', () => {
  let job: DocumentReminderJob;

  const mockPrismaService = {
    document: {
      findMany: jest.fn(),
    },
    userCompanyMembership: {
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
          companyId: 'company-1',
          globalDepartmentId: 'dept-1',
        },
      ];

      const mockMemberships = [
        { userId: 'user-1' },
        { userId: 'user-2' },
      ];

      mockPrismaService.document.findMany.mockResolvedValue(mockDocuments);
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue(mockMemberships);
      mockNotificationProducer.sendDocumentReminder.mockResolvedValue(undefined);

      await job.handleDocumentReminder();

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith({
        where: { status: DocumentStatus.PENDING },
      });

      expect(mockPrismaService.userCompanyMembership.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          isActive: true,
          allowedDepartments: {
            some: { globalDepartmentId: 'dept-1' },
          },
        },
        select: { userId: true },
      });

      expect(mockNotificationProducer.sendDocumentReminder).toHaveBeenCalledWith({
        userIds: ['user-1', 'user-2'],
        documentId: 'doc-1',
        documentName: 'Contract A',
        documentNumber: 'DOC-001',
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
      });
    });

    it('should handle zero documents', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([]);
      await job.handleDocumentReminder();
      expect(mockNotificationProducer.sendDocumentReminder).not.toHaveBeenCalled();
    });

    it('should handle documents with no members', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([{ id: 'doc-1', companyId: 'c1', globalDepartmentId: 'd1' }]);
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([]);
      
      await job.handleDocumentReminder();
      
      expect(mockNotificationProducer.sendDocumentReminder).not.toHaveBeenCalled();
    });
  });
});
