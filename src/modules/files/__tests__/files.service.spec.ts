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
      expect(mockPrismaService.file.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ globalDepartmentId: 'dept-id' }),
        })
      );
    });

    it('should throw error for oversized file', async () => {
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
});
