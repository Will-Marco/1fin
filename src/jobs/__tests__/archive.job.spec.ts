import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveService } from '../../modules/archive/archive.service';
import { ArchiveJob } from '../archive.job';

describe('ArchiveJob', () => {
  let job: ArchiveJob;

  const mockArchiveService = {
    archiveOldData: jest.fn(),
    archiveOrphanFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveJob,
        { provide: ArchiveService, useValue: mockArchiveService },
      ],
    }).compile();

    job = module.get<ArchiveJob>(ArchiveJob);
    jest.clearAllMocks();
  });

  describe('handleArchive', () => {
    it('should call archiveOldData and archiveOrphanFiles', async () => {
      const mockResult = {
        messagesArchived: 10,
        filesArchived: 5,
        documentsArchived: 2,
        messageEditsDeleted: 3,
        messageForwardsDeleted: 4,
      };

      mockArchiveService.archiveOldData.mockResolvedValue(mockResult);
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(3);

      await job.handleArchive();

      expect(mockArchiveService.archiveOldData).toHaveBeenCalled();
      expect(mockArchiveService.archiveOrphanFiles).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockArchiveService.archiveOldData.mockRejectedValue(new Error('Test error'));
      await expect(job.handleArchive()).resolves.not.toThrow();
    });
  });
});
