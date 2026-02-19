import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveController } from '../archive.controller';
import { ArchiveService } from '../archive.service';

describe('ArchiveController', () => {
  let controller: ArchiveController;

  const mockArchiveService = {
    searchMessages: jest.fn(),
    searchFiles: jest.fn(),
    searchDocuments: jest.fn(),
    getStatistics: jest.fn(),
    archiveOldData: jest.fn(),
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
        data: [{ id: 'm1', content: 'Test' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockArchiveService.searchMessages.mockResolvedValue(mockResult);

      const result = await controller.searchMessages({
        globalDepartmentId: 'd1',
        content: 'test',
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockResult);
      expect(mockArchiveService.searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ globalDepartmentId: 'd1' })
      );
    });
  });

  describe('runArchive', () => {
    it('should run archive process manually', async () => {
      const mockResult = {
        messagesArchived: 10,
        filesArchived: 5,
        documentsArchived: 2,
        messageEditsDeleted: 0,
        messageForwardsDeleted: 0,
      };

      mockArchiveService.archiveOldData.mockResolvedValue(mockResult);
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(3);

      const result = await controller.runArchive();

      expect(result).toEqual({
        ...mockResult,
        orphanFilesArchived: 3,
      });
    });
  });
});
