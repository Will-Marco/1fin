import { Test, TestingModule } from '@nestjs/testing';

// Mock generated modules before importing controller
jest.mock(
  'generated/prisma/enums',
  () => ({
    Role: {
      SUPER_ADMIN: 'SUPER_ADMIN',
      ADMIN: 'ADMIN',
      EMPLOYEE: 'EMPLOYEE',
      FOUNDER: 'FOUNDER',
      DIRECTOR: 'DIRECTOR',
      OPERATOR: 'OPERATOR',
    },
    FileType: {
      IMAGE: 'IMAGE',
      DOCUMENT: 'DOCUMENT',
      VOICE: 'VOICE',
      OTHER: 'OTHER',
    },
  }),
  { virtual: true },
);

jest.mock(
  'src/common/decorators',
  () => ({
    CurrentUser: () => () => {},
    Roles: () => () => {},
  }),
  { virtual: true },
);

jest.mock(
  'src/common/guards',
  () => ({
    RolesGuard: class MockRolesGuard {},
  }),
  { virtual: true },
);

jest.mock(
  '../auth/guards',
  () => ({
    JwtAuthGuard: class MockJwtAuthGuard {},
  }),
  { virtual: true },
);

import { FilesController } from '../files.controller';
import { FilesService } from '../files.service';

const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  EMPLOYEE: 'EMPLOYEE',
  FOUNDER: 'FOUNDER',
  DIRECTOR: 'DIRECTOR',
  OPERATOR: 'OPERATOR',
} as const;

const FileType = {
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
  VOICE: 'VOICE',
  OTHER: 'OTHER',
};
describe('FilesController', () => {
  let controller: FilesController;
  let service: FilesService;

  const mockFile = {
    id: 'file-id',
    uploadedBy: 'user-id',
    departmentId: 'dept-id',
    originalName: 'test.jpg',
    fileName: 'uuid-test.jpg',
    fileSize: 1024,
    mimeType: 'image/jpeg',
    fileType: FileType.IMAGE,
    path: 'images/uuid-test.jpg',
    url: 'http://localhost/uploads/images/uuid-test.jpg',
    isDeleted: false,
    uploader: { id: 'user-id', name: 'Test User', username: 'testuser' },
  };

  const mockFilesService = {
    upload: jest.fn(),
    uploadMultiple: jest.fn(),
    findOne: jest.fn(),
    findByDepartment: jest.fn(),
    remove: jest.fn(),
    getDeleted: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: mockFilesService }],
    }).compile();

    controller = module.get<FilesController>(FilesController);
    service = module.get<FilesService>(FilesService);
  });

  describe('upload', () => {
    it('should upload a file', async () => {
      const mockMulterFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockFilesService.upload.mockResolvedValue(mockFile);

      const result = await controller.upload(
        mockMulterFile,
        { departmentId: 'dept-id' },
        'user-id',
      );

      expect(result).toEqual(mockFile);
      expect(service.upload).toHaveBeenCalledWith(
        mockMulterFile,
        { departmentId: 'dept-id' },
        'user-id',
      );
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files', async () => {
      const mockMulterFile = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockFilesService.uploadMultiple.mockResolvedValue([mockFile, mockFile]);

      const result = await controller.uploadMultiple(
        [mockMulterFile, mockMulterFile],
        { departmentId: 'dept-id' },
        'user-id',
      );

      expect(result).toHaveLength(2);
      expect(service.uploadMultiple).toHaveBeenCalledWith(
        [mockMulterFile, mockMulterFile],
        { departmentId: 'dept-id' },
        'user-id',
      );
    });
  });

  describe('findOne', () => {
    it('should return a file', async () => {
      mockFilesService.findOne.mockResolvedValue(mockFile);

      const result = await controller.findOne(
        'file-id',
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result).toEqual(mockFile);
      expect(service.findOne).toHaveBeenCalledWith(
        'file-id',
        'user-id',
        Role.EMPLOYEE,
      );
    });
  });

  describe('findByDepartment', () => {
    it('should return paginated files', async () => {
      const mockResult = {
        data: [mockFile],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockFilesService.findByDepartment.mockResolvedValue(mockResult);

      const result = await controller.findByDepartment(
        'dept-id',
        '1',
        '20',
        'false',
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.data).toHaveLength(1);
      expect(service.findByDepartment).toHaveBeenCalledWith(
        'dept-id',
        'user-id',
        Role.EMPLOYEE,
        1,
        20,
        false,
      );
    });

    it('should parse includeDeleted correctly', async () => {
      mockFilesService.findByDepartment.mockResolvedValue({
        data: [],
        meta: {},
      });

      await controller.findByDepartment(
        'dept-id',
        '1',
        '20',
        'true',
        'admin-id',
        Role.ADMIN,
      );

      expect(service.findByDepartment).toHaveBeenCalledWith(
        'dept-id',
        'admin-id',
        Role.ADMIN,
        1,
        20,
        true,
      );
    });
  });

  describe('remove', () => {
    it('should delete a file', async () => {
      mockFilesService.remove.mockResolvedValue({ message: "Fayl o'chirildi" });

      const result = await controller.remove(
        'file-id',
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.message).toBe("Fayl o'chirildi");
      expect(service.remove).toHaveBeenCalledWith(
        'file-id',
        'user-id',
        Role.EMPLOYEE,
      );
    });
  });

  describe('getDeleted', () => {
    it('should return deleted files for admin', async () => {
      const mockResult = {
        data: [{ ...mockFile, isDeleted: true }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockFilesService.getDeleted.mockResolvedValue(mockResult);

      const result = await controller.getDeleted(
        'dept-id',
        '1',
        '20',
        'admin-id',
        Role.ADMIN,
      );

      expect(result.data).toHaveLength(1);
      expect(service.getDeleted).toHaveBeenCalledWith(
        'admin-id',
        Role.ADMIN,
        'dept-id',
        1,
        20,
      );
    });
  });

  describe('restore', () => {
    it('should restore a deleted file', async () => {
      mockFilesService.restore.mockResolvedValue({ message: 'Fayl tiklandi' });

      const result = await controller.restore(
        'file-id',
        'admin-id',
        Role.ADMIN,
      );

      expect(result.message).toBe('Fayl tiklandi');
      expect(service.restore).toHaveBeenCalledWith(
        'file-id',
        'admin-id',
        Role.ADMIN,
      );
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete a file', async () => {
      mockFilesService.permanentDelete.mockResolvedValue({
        message: "Fayl butunlay o'chirildi",
      });

      const result = await controller.permanentDelete(
        'file-id',
        'admin-id',
        Role.ADMIN,
      );

      expect(result.message).toBe("Fayl butunlay o'chirildi");
      expect(service.permanentDelete).toHaveBeenCalledWith(
        'file-id',
        'admin-id',
        Role.ADMIN,
      );
    });
  });
});
