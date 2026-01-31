import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FilesService } from '../files.service';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER } from '../storage/storage.interface';
import { FileType, Role } from '../../../../generated/prisma/client';

describe('FilesService', () => {
  let service: FilesService;

  const mockFile = {
    id: 'file-id',
    uploadedBy: 'user-id',
    departmentId: 'dept-id',
    messageId: null,
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
    updatedAt: new Date(),
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
    },
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn(),
    exists: jest.fn(),
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
    const mockMulterFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
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
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.upload(mockMulterFile, { departmentId: 'dept-id' }, 'user-id');

      expect(result.id).toBe('file-id');
      expect(result.url).toBe('http://localhost/uploads/images/uuid-test.jpg');
      expect(mockStorageProvider.upload).toHaveBeenCalledWith(mockMulterFile, 'images');
    });

    it('should throw error for oversized image file', async () => {
      const largeFile = { ...mockMulterFile, size: 6 * 1024 * 1024 }; // 6MB

      await expect(
        service.upload(largeFile, { departmentId: 'dept-id' }, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for oversized voice file', async () => {
      const voiceFile = {
        ...mockMulterFile,
        mimetype: 'audio/mpeg',
        size: 4 * 1024 * 1024, // 4MB
      };

      await expect(
        service.upload(voiceFile, { departmentId: 'dept-id' }, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect correct file type for document', async () => {
      const pdfFile = { ...mockMulterFile, mimetype: 'application/pdf' };

      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'test.pdf',
        fileName: 'uuid-test.pdf',
        path: 'documents/uuid-test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      mockPrismaService.file.create.mockResolvedValue({
        ...mockFile,
        fileType: FileType.DOCUMENT,
      });
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/documents/uuid-test.pdf');

      await service.upload(pdfFile, { departmentId: 'dept-id' }, 'user-id');

      expect(mockStorageProvider.upload).toHaveBeenCalledWith(pdfFile, 'documents');
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files', async () => {
      const mockMulterFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'test.jpg',
        fileName: 'uuid-test.jpg',
        path: 'images/uuid-test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      mockPrismaService.file.create.mockResolvedValue(mockFile);
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.uploadMultiple(
        [mockMulterFile, mockMulterFile],
        { departmentId: 'dept-id' },
        'user-id',
      );

      expect(result).toHaveLength(2);
      expect(mockStorageProvider.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe('findOne', () => {
    it('should return a file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.findOne('file-id', 'user-id', Role.EMPLOYEE);

      expect(result.id).toBe('file-id');
      expect(result.url).toBeDefined();
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('invalid', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should hide deleted files from non-admin users', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({
        ...mockFile,
        isDeleted: true,
      });

      await expect(
        service.findOne('file-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(NotFoundException);
    });

    it('should show deleted files to admin', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({
        ...mockFile,
        isDeleted: true,
      });
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.findOne('file-id', 'admin-id', Role.ADMIN);

      expect(result.id).toBe('file-id');
    });
  });

  describe('findByDepartment', () => {
    it('should return paginated files', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([mockFile]);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.findByDepartment(
        'dept-id',
        'user-id',
        Role.EMPLOYEE,
        1,
        20,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should exclude deleted files for non-admin', async () => {
      await service.findByDepartment('dept-id', 'user-id', Role.EMPLOYEE, 1, 20, true);

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDeleted: false }),
        }),
      );
    });

    it('should include deleted files for admin when requested', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);
      mockPrismaService.file.count.mockResolvedValue(0);

      await service.findByDepartment('dept-id', 'admin-id', Role.ADMIN, 1, 20, true);

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ isDeleted: false }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a file by owner', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockPrismaService.file.update.mockResolvedValue({
        ...mockFile,
        isDeleted: true,
      });

      const result = await service.remove('file-id', 'user-id', Role.EMPLOYEE);

      expect(result.message).toBe("Fayl o'chirildi");
      expect(mockPrismaService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-id' },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
          deletedBy: 'user-id',
        },
      });
    });

    it('should allow admin to delete any file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });
      mockPrismaService.file.update.mockResolvedValue({});

      const result = await service.remove('file-id', 'admin-id', Role.ADMIN);

      expect(result.message).toBe("Fayl o'chirildi");
    });

    it('should throw ForbiddenException for non-owner non-admin', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({
        ...mockFile,
        uploadedBy: 'other-user',
      });

      await expect(
        service.remove('file-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('invalid', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDeleted', () => {
    it('should return deleted files for admin', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([
        { ...mockFile, isDeleted: true },
      ]);
      mockPrismaService.file.count.mockResolvedValue(1);
      mockStorageProvider.getUrl.mockReturnValue('http://localhost/uploads/images/uuid-test.jpg');

      const result = await service.getDeleted('admin-id', Role.ADMIN, undefined, 1, 20);

      expect(result.data).toHaveLength(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.getDeleted('user-id', Role.EMPLOYEE, undefined, 1, 20),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should filter by departmentId', async () => {
      mockPrismaService.file.findMany.mockResolvedValue([]);
      mockPrismaService.file.count.mockResolvedValue(0);

      await service.getDeleted('admin-id', Role.ADMIN, 'dept-id', 1, 20);

      expect(mockPrismaService.file.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: true, departmentId: 'dept-id' },
        }),
      );
    });
  });

  describe('restore', () => {
    it('should restore a deleted file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue({
        ...mockFile,
        isDeleted: true,
      });
      mockPrismaService.file.update.mockResolvedValue(mockFile);

      const result = await service.restore('file-id', 'admin-id', Role.ADMIN);

      expect(result.message).toBe('Fayl tiklandi');
      expect(mockPrismaService.file.update).toHaveBeenCalledWith({
        where: { id: 'file-id' },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
      });
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.restore('file-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(
        service.restore('invalid', 'admin-id', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if file not deleted', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);

      await expect(
        service.restore('file-id', 'admin-id', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete a file', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(mockFile);
      mockStorageProvider.delete.mockResolvedValue(undefined);
      mockPrismaService.file.delete.mockResolvedValue(mockFile);

      const result = await service.permanentDelete('file-id', 'admin-id', Role.ADMIN);

      expect(result.message).toBe("Fayl butunlay o'chirildi");
      expect(mockStorageProvider.delete).toHaveBeenCalledWith(mockFile.path);
      expect(mockPrismaService.file.delete).toHaveBeenCalledWith({
        where: { id: 'file-id' },
      });
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.permanentDelete('file-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockPrismaService.file.findUnique.mockResolvedValue(null);

      await expect(
        service.permanentDelete('invalid', 'admin-id', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
