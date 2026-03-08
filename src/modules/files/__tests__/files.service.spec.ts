import {
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FileType, SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FilesService } from '../files.service';
import { STORAGE_PROVIDER } from '../storage/storage.interface';

describe('FilesService', () => {
  let service: FilesService;

  const mockFile: any = {
    id: 'file-id',
    uploadedBy: 'user-id',
    globalDepartmentId: 'dept-id',
    messageId: null,
    documentId: null,
    originalName: 'test.jpg',
    fileName: 'uuid-test.jpg',
    fileSize: 1024,
    mimeType: 'image/jpeg',
    fileType: FileType.IMAGE,
    path: 'images/uuid-test.jpg',
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(),
    uploader: { id: 'user-id', name: 'Test User', username: 'testuser' },
  };

  const mockPrismaService = {
    file: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    globalDepartment: {
      findUnique: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('upload', () => {
    const mockMulterFile: any = {
      mimetype: 'image/jpeg',
      size: 1024,
      originalname: 'test.jpg',
    };

    it('should upload a file successfully', async () => {
      // Mock validations
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({ id: 'dept-id' });

      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'test.jpg',
        fileName: 'uuid-test.jpg',
        path: 'images/uuid-test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      mockPrismaService.file.create.mockResolvedValue(mockFile);
      mockStorageProvider.getUrl.mockReturnValue('http://url');

      const result = await service.upload(mockMulterFile, { globalDepartmentId: 'dept-id' }, 'user-id');

      expect(result.id).toBe('file-id');
      expect(mockPrismaService.globalDepartment.findUnique).toHaveBeenCalledWith({
        where: { id: 'dept-id' },
        select: { id: true },
      });
      expect(mockPrismaService.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ globalDepartmentId: 'dept-id' }),
        })
      );
    });

    it('should throw error for oversized file', async () => {
      // Mock validations to pass
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({ id: 'dept-id' });

      const largeFile = { ...mockMulterFile, size: 50 * 1024 * 1024 };
      await expect(
        service.upload(largeFile, { globalDepartmentId: 'dept-id' }, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockStorageProvider.getUrl.mockReturnValue('http://url');

      const result = await service.findOne('file-id', 'user-id', null);

      expect(result.id).toBe('file-id');
      expect(result.url).toBe('http://url');
    });

    it('should hide deleted files from non-admin', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({ ...mockFile, isDeleted: true });
      await expect(
        service.findOne('file-id', 'user-id', null),
      ).rejects.toThrow(NotFoundException);
    });

    it('should show deleted files to fin-admin', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({ ...mockFile, isDeleted: true });
      mockStorageProvider.getUrl.mockReturnValue('http://url');
      const result = await service.findOne('file-id', 'user-id', SystemRole.FIN_ADMIN);
      expect(result.id).toBe('file-id');
    });
  });

  describe('findByDepartment', () => {
    it('should return files by globalDepartmentId', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([mockFile]);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockStorageProvider.getUrl.mockReturnValue('http://url');

      const result = await service.findByDepartment('dept-1', 'user-1', null);

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ globalDepartmentId: 'dept-1' }),
        })
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);

      const result = await service.remove('file-id', 'user-id', null);

      expect(result.message).toBe("Fayl o'chirildi");
      expect(mockPrismaService.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDeleted: true }),
        })
      );
    });
  });

  describe('attachToMessage', () => {
    it('should attach a file to a message', async () => {
      const mockMessage = { id: 'msg-id', senderId: 'user-id' };
      const updatedFile = { ...mockFile, messageId: 'msg-id' };

      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.file.update.mockResolvedValue(updatedFile);
      mockStorageProvider.getUrl.mockReturnValue('http://url');

      const result = await service.attachToMessage('file-id', 'msg-id', 'user-id');

      expect(result.messageId).toBe('msg-id');
      expect(mockPrismaService.file.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'file-id' },
          data: { messageId: 'msg-id' },
        })
      );
    });

    it('should throw error if file not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(
        service.attachToMessage('file-id', 'msg-id', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if message not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.attachToMessage('file-id', 'msg-id', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upload with validations', () => {
    it('should throw error if messageId does not exist', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.upload(
          { mimetype: 'image/jpeg', size: 1024 } as any,
          { messageId: 'nonexistent-msg-id' },
          'user-id'
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if documentId does not exist', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(
        service.upload(
          { mimetype: 'image/jpeg', size: 1024 } as any,
          { documentId: 'nonexistent-doc-id' },
          'user-id'
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if globalDepartmentId does not exist', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(null);

      await expect(
        service.upload(
          { mimetype: 'image/jpeg', size: 1024 } as any,
          { globalDepartmentId: 'nonexistent-dept-id' },
          'user-id'
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upload successfully with valid messageId', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({ id: 'msg-id' });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'test.jpg',
        fileName: 'uuid-test.jpg',
        path: 'images/uuid-test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      mockPrismaService.file.create.mockResolvedValue({ ...mockFile, messageId: 'msg-id' });
      mockStorageProvider.getUrl.mockReturnValue('http://url');

      const result = await service.upload(
        { mimetype: 'image/jpeg', size: 1024, originalname: 'test.jpg' } as any,
        { messageId: 'msg-id' },
        'user-id'
      );

      expect(result.messageId).toBe('msg-id');
      expect(mockPrismaService.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-id' },
        select: { id: true },
      });
    });
  });
});
