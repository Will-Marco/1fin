import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { ArchiveService } from '../archive.service';

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
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    documentArchive: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentActionLog: {
      deleteMany: jest.fn(),
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

  describe('archiveOldData', () => {
    it('should archive both messages and documents', async () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 4);

      mockPrismaService.message.findMany.mockResolvedValue([
        {
          id: 'm1',
          globalDepartmentId: 'd1',
          companyId: 'c1',
          senderId: 'u1',
          createdAt: oldDate,
          files: [],
          edits: [],
          forwardedAsOriginal: [],
          forwardedAsNew: [],
        },
      ]);
      mockPrismaService.document.findMany.mockResolvedValue([
        { id: 'doc1', globalDepartmentId: 'd1', companyId: 'c1', documentName: 'Doc', documentNumber: '123', createdById: 'u1', expiresAt: oldDate, createdAt: oldDate, files: [] }
      ]);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          messageArchive: { create: jest.fn() },
          documentArchive: { create: jest.fn() },
          fileArchive: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
          file: { deleteMany: jest.fn() },
          messageEdit: { deleteMany: jest.fn() },
          messageForward: { deleteMany: jest.fn() },
          message: { deleteMany: jest.fn() },
          documentActionLog: { deleteMany: jest.fn() },
          document: { deleteMany: jest.fn() },
        };
        return await callback(txMock);
      });

      const result = await service.archiveOldData();

      expect(result.messagesArchived).toBe(1);
      expect(result.documentsArchived).toBe(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchMessages', () => {
    it('should search with globalDepartmentId filter', async () => {
      mockPrismaService.messageArchive.findMany.mockResolvedValue([]);
      mockPrismaService.messageArchive.count.mockResolvedValue(0);

      await service.searchMessages({
        globalDepartmentId: 'dept-1',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.messageArchive.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            globalDepartmentId: 'dept-1',
          }),
        }),
      );
    });
  });

  describe('searchDocuments', () => {
    it('should search archived documents', async () => {
      const mockDocs = [{ id: 'doc1', documentNumber: '123' }];
      mockPrismaService.documentArchive.findMany.mockResolvedValue(mockDocs);
      mockPrismaService.documentArchive.count.mockResolvedValue(1);

      const result = await service.searchDocuments({ documentNumber: '123' });

      expect(result.data).toEqual(mockDocs);
      expect(mockPrismaService.documentArchive.findMany).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return counts for messages, files and documents', async () => {
      mockPrismaService.messageArchive.count.mockResolvedValue(10);
      mockPrismaService.fileArchive.count.mockResolvedValue(20);
      mockPrismaService.documentArchive.count.mockResolvedValue(5);

      const result = await service.getStatistics();

      expect(result).toEqual({
        messages: 10,
        files: 20,
        documents: 5,
      });
    });
  });
});
