import { Test, TestingModule } from '@nestjs/testing';
import { ArchiveJob } from '../archive.job';
import { ArchiveService } from '../../modules/archive/archive.service';

jest.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {},
}), { virtual: true });

describe('ArchiveJob', () => {
  let job: ArchiveJob;

  const mockArchiveService = {
    archiveOldMessages: jest.fn(),
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
    it('should archive old messages and orphan files', async () => {
      const mockMessageResult = {
        messagesArchived: 10,
        filesArchived: 5,
        documentApprovalsArchived: 2,
        messageEditsDeleted: 3,
        messageForwardsDeleted: 4,
      };

      mockArchiveService.archiveOldMessages.mockResolvedValue(mockMessageResult);
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(3);

      await job.handleArchive();

      expect(mockArchiveService.archiveOldMessages).toHaveBeenCalled();
      expect(mockArchiveService.archiveOrphanFiles).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockArchiveService.archiveOldMessages.mockRejectedValue(new Error('Database error'));

      await expect(job.handleArchive()).resolves.not.toThrow();
    });

    it('should continue with orphan files even if messages archive returns zero', async () => {
      mockArchiveService.archiveOldMessages.mockResolvedValue({
        messagesArchived: 0,
        filesArchived: 0,
        documentApprovalsArchived: 0,
        messageEditsDeleted: 0,
        messageForwardsDeleted: 0,
      });
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(5);

      await job.handleArchive();

      expect(mockArchiveService.archiveOrphanFiles).toHaveBeenCalled();
    });
  });

  describe('triggerManually', () => {
    it('should call handleArchive', async () => {
      mockArchiveService.archiveOldMessages.mockResolvedValue({
        messagesArchived: 0,
        filesArchived: 0,
        documentApprovalsArchived: 0,
        messageEditsDeleted: 0,
        messageForwardsDeleted: 0,
      });
      mockArchiveService.archiveOrphanFiles.mockResolvedValue(0);

      const handleArchiveSpy = jest.spyOn(job, 'handleArchive');

      await job.triggerManually();

      expect(handleArchiveSpy).toHaveBeenCalled();
    });
  });
});
