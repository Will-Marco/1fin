import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveService } from '../archive.service';
import { PrismaService } from '../../../database/prisma.service';

jest.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
}), { virtual: true });

describe('ArchiveService', () => {
  let service: ArchiveService;

  const mockPrismaService = {
    message: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    messageArchive: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    fileArchive: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentApproval: {
      deleteMany: jest.fn(),
    },
    documentApprovalArchive: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    messageEdit: {
      deleteMany: jest.fn(),
    },
    messageForward: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ArchiveService>(ArchiveService);

    jest.clearAllMocks();
  });

  describe('archiveOldMessages', () => {
    it('should return zero counts when no messages to archive', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([]);

      const result = await service.archiveOldMessages();

      expect(result).toEqual({
        messagesArchived: 0,
        filesArchived: 0,
        documentApprovalsArchived: 0,
        messageEditsDeleted: 0,
        messageForwardsDeleted: 0,
      });
    });

    it('should archive messages with files and document approvals', async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4);

      const mockMessages = [
        {
          id: 'msg-1',
          departmentId: 'dept-1',
          senderId: 'user-1',
          content: 'Test message',
          type: 'TEXT',
          voiceDuration: null,
          replyToId: null,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          isEdited: false,
          parentId: null,
          status: 'SENT',
          isOutgoing: true,
          createdAt: oldDate,
          files: [
            {
              id: 'file-1',
              departmentId: 'dept-1',
              messageId: 'msg-1',
              uploadedBy: 'user-1',
              originalName: 'test.pdf',
              fileName: 'uuid.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
              fileType: 'DOCUMENT',
              path: '/uploads/documents/uuid.pdf',
              documentNumber: null,
              status: 'PENDING',
              isOutgoing: true,
              isDeleted: false,
              deletedAt: null,
              deletedBy: null,
              createdAt: oldDate,
            },
          ],
          documentApproval: {
            id: 'approval-1',
            messageId: 'msg-1',
            documentName: 'Test Doc',
            documentNumber: 'DOC-001',
            status: 'APPROVED',
            rejectionReason: null,
            approvedBy: 'admin-1',
            approvedAt: new Date(),
            createdAt: oldDate,
          },
          edits: [{ id: 'edit-1' }],
          forwards: [{ id: 'forward-1' }, { id: 'forward-2' }],
        },
      ];

      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          messageArchive: { create: jest.fn() },
          fileArchive: { create: jest.fn() },
          documentApprovalArchive: { create: jest.fn() },
          file: { deleteMany: jest.fn() },
          documentApproval: { deleteMany: jest.fn() },
          messageEdit: { deleteMany: jest.fn() },
          messageForward: { deleteMany: jest.fn() },
          message: { deleteMany: jest.fn() },
        };
        await callback(txMock);
      });

      const result = await service.archiveOldMessages();

      expect(result.messagesArchived).toBe(1);
      expect(result.filesArchived).toBe(1);
      expect(result.documentApprovalsArchived).toBe(1);
      expect(result.messageEditsDeleted).toBe(1);
      expect(result.messageForwardsDeleted).toBe(2);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should archive message without document approval', async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4);

      const mockMessages = [
        {
          id: 'msg-2',
          departmentId: 'dept-1',
          senderId: 'user-1',
          content: 'Simple message',
          type: 'TEXT',
          voiceDuration: null,
          replyToId: null,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          isEdited: false,
          parentId: null,
          status: 'SENT',
          isOutgoing: true,
          createdAt: oldDate,
          files: [],
          documentApproval: null,
          edits: [],
          forwards: [],
        },
      ];

      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          messageArchive: { create: jest.fn() },
          fileArchive: { create: jest.fn() },
          documentApprovalArchive: { create: jest.fn() },
          file: { deleteMany: jest.fn() },
          documentApproval: { deleteMany: jest.fn() },
          messageEdit: { deleteMany: jest.fn() },
          messageForward: { deleteMany: jest.fn() },
          message: { deleteMany: jest.fn() },
        };
        await callback(txMock);
      });

      const result = await service.archiveOldMessages();

      expect(result.messagesArchived).toBe(1);
      expect(result.filesArchived).toBe(0);
      expect(result.documentApprovalsArchived).toBe(0);
    });
  });

  describe('archiveOrphanFiles', () => {
    it('should return 0 when no orphan files', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);

      const result = await service.archiveOrphanFiles();

      expect(result).toBe(0);
    });

    it('should archive orphan files', async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4);

      const mockFiles = [
        {
          id: 'file-orphan-1',
          departmentId: 'dept-1',
          messageId: null,
          uploadedBy: 'user-1',
          originalName: 'orphan.pdf',
          fileName: 'uuid-orphan.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          fileType: 'DOCUMENT',
          path: '/uploads/documents/uuid-orphan.pdf',
          documentNumber: null,
          status: 'PENDING',
          isOutgoing: true,
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          createdAt: oldDate,
        },
      ];

      mockPrismaService.file.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          fileArchive: { create: jest.fn() },
          file: { deleteMany: jest.fn() },
        };
        await callback(txMock);
      });

      const result = await service.archiveOrphanFiles();

      expect(result).toBe(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('searchMessages', () => {
    it('should search archived messages with pagination', async () => {
      const mockMessages = [
        { id: 'archived-1', content: 'Test', departmentId: 'dept-1' },
        { id: 'archived-2', content: 'Test 2', departmentId: 'dept-1' },
      ];

      mockPrismaService.messageArchive.findMany.mockResolvedValue(mockMessages);
      mockPrismaService.messageArchive.count.mockResolvedValue(2);

      const result = await service.searchMessages({
        departmentId: 'dept-1',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockMessages);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should search with content filter', async () => {
      mockPrismaService.messageArchive.findMany.mockResolvedValue([]);
      mockPrismaService.messageArchive.count.mockResolvedValue(0);

      await service.searchMessages({
        content: 'search term',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.messageArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: 'search term', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should search with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-30');

      mockPrismaService.messageArchive.findMany.mockResolvedValue([]);
      mockPrismaService.messageArchive.count.mockResolvedValue(0);

      await service.searchMessages({
        startDate,
        endDate,
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.messageArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });
  });

  describe('searchFiles', () => {
    it('should search archived files', async () => {
      const mockFiles = [{ id: 'file-1', originalName: 'test.pdf' }];

      mockPrismaService.fileArchive.findMany.mockResolvedValue(mockFiles);
      mockPrismaService.fileArchive.count.mockResolvedValue(1);

      const result = await service.searchFiles({
        fileName: 'test',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockFiles);
      expect(mockPrismaService.fileArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            originalName: { contains: 'test', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by department', async () => {
      mockPrismaService.fileArchive.findMany.mockResolvedValue([]);
      mockPrismaService.fileArchive.count.mockResolvedValue(0);

      await service.searchFiles({
        departmentId: 'dept-1',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.fileArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: 'dept-1',
          }),
        }),
      );
    });
  });

  describe('searchDocumentApprovals', () => {
    it('should search archived document approvals', async () => {
      const mockApprovals = [
        { id: 'approval-1', documentNumber: 'DOC-001', documentName: 'Test' },
      ];

      mockPrismaService.documentApprovalArchive.findMany.mockResolvedValue(mockApprovals);
      mockPrismaService.documentApprovalArchive.count.mockResolvedValue(1);

      const result = await service.searchDocumentApprovals({
        documentNumber: 'DOC',
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockApprovals);
    });

    it('should search by document name', async () => {
      mockPrismaService.documentApprovalArchive.findMany.mockResolvedValue([]);
      mockPrismaService.documentApprovalArchive.count.mockResolvedValue(0);

      await service.searchDocumentApprovals({
        documentName: 'Invoice',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.documentApprovalArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentName: { contains: 'Invoice', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return archive statistics', async () => {
      mockPrismaService.messageArchive.count.mockResolvedValue(100);
      mockPrismaService.fileArchive.count.mockResolvedValue(250);
      mockPrismaService.documentApprovalArchive.count.mockResolvedValue(50);

      const result = await service.getStatistics();

      expect(result).toEqual({
        messages: 100,
        files: 250,
        documentApprovals: 50,
      });
    });
  });
});
