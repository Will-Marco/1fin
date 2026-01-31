import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveController } from '../archive.controller';
import { ArchiveService } from '../archive.service';

jest.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN' },
}), { virtual: true });
jest.mock('../../../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
  Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN' },
}), { virtual: true });
jest.mock('../../../../generated/prisma/enums', () => ({ Role: { SUPER_ADMIN: 'SUPER_ADMIN', ADMIN: 'ADMIN' } }), { virtual: true });

describe('ArchiveController', () => {
  let controller: ArchiveController;

  const mockArchiveService = {
    searchMessages: jest.fn(),
    searchFiles: jest.fn(),
    searchDocumentApprovals: jest.fn(),
    getStatistics: jest.fn(),
    archiveOldMessages: jest.fn(),
    archiveOrphanFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArchiveController],
      providers: [
        { provide: ArchiveService, useValue: mockArchiveService },
      ],
    }).compile();

    controller = module.get<ArchiveController>(ArchiveController);

    jest.clearAllMocks();
  });

  describe('searchMessages', () => {
    it('should search archived messages', async () => {
      const mockResult = {
        data: [{ id: 'msg-1', content: 'Test' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockArchiveService.searchMessages.mockResolvedValue(mockResult);

      const result = await controller.searchMessages({
        departmentId: 'dept-1',
        content: 'test',
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockResult);
      expect(mockArchiveService.searchMessages).toHaveBeenCalledWith({
        departmentId: 'dept-1',
        senderId: undefined,
        content: 'test',
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should parse date strings', async () => {
      mockArchiveService.searchMessages.mockResolvedValue({ data: [], meta: {} });

      await controller.searchMessages({
        startDate: '2024-01-01',
        endDate: '2024-06-30',
        page: 1,
        limit: 20,
      });

      expect(mockArchiveService.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });
  });

  describe('searchFiles', () => {
    it('should search archived files', async () => {
      const mockResult = {
        data: [{ id: 'file-1', originalName: 'test.pdf' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockArchiveService.searchFiles.mockResolvedValue(mockResult);

      const result = await controller.searchFiles({
        fileName: 'test',
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('searchDocumentApprovals', () => {
    it('should search archived document approvals', async () => {
      const mockResult = {
        data: [{ id: 'approval-1', documentNumber: 'DOC-001' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockArchiveService.searchDocumentApprovals.mockResolvedValue(mockResult);

      const result = await controller.searchDocumentApprovals({
        documentNumber: 'DOC',
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockResult);
    });
  });

  describe('getStatistics', () => {
    it('should return archive statistics', async () => {
      const mockStats = {
        messages: 100,
        files: 250,
        documentApprovals: 50,
      };

      mockArchiveService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(result).toEqual(mockStats);
    });
  });

  describe('runArchive', () => {
    it('should run archive process manually', async () => {
      const mockMessageResult = {
        messagesArchived: 10,
        filesArchived: 5,
        documentApprovalsArchived: 2,
        messageEditsDeleted: 3,
        messageForwardsDeleted: 4,
      };

      mockArchiveService.archiveOldMessages.mockResolvedValue(mockMessageResult);
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(3);

      const result = await controller.runArchive();

      expect(result).toEqual({
        ...mockMessageResult,
        orphanFilesArchived: 3,
      });
      expect(mockArchiveService.archiveOldMessages).toHaveBeenCalled();
      expect(mockArchiveService.archiveOrphanFiles).toHaveBeenCalled();
    });
  });
});
