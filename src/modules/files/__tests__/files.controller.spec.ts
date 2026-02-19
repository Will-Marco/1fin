jest.mock('../../../common/decorators', () => ({
  CurrentUser: () => () => {},
  SystemRoles: () => () => {},
}));

jest.mock('../../../common/guards', () => ({
  SystemRoleGuard: class {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from '../files.controller';
import { FilesService } from '../files.service';

describe('FilesController', () => {
  let controller: FilesController;

  const mockFile: any = {
    id: 'file-id',
    uploadedBy: 'user-id',
    globalDepartmentId: 'dept-id',
    originalName: 'test.jpg',
    url: 'http://url',
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
  });

  describe('upload', () => {
    it('should upload a file', async () => {
      const mockMulterFile: any = { originalname: 'test.jpg' };
      mockFilesService.upload.mockResolvedValue(mockFile);

      const result = await controller.upload(
        mockMulterFile,
        { globalDepartmentId: 'dept-id' },
        'user-id',
      );

      expect(result).toEqual(mockFile);
      expect(mockFilesService.upload).toHaveBeenCalledWith(
        mockMulterFile,
        { globalDepartmentId: 'dept-id' },
        'user-id',
      );
    });
  });

  describe('findOne', () => {
    it('should return a file', async () => {
      mockFilesService.findOne.mockResolvedValue(mockFile);

      const result = await controller.findOne('file-id', 'user-id', null);

      expect(result).toEqual(mockFile);
      expect(mockFilesService.findOne).toHaveBeenCalledWith('file-id', 'user-id', null);
    });
  });

  describe('findByDepartment', () => {
    it('should return paginated files', async () => {
      mockFilesService.findByDepartment.mockResolvedValue({ data: [mockFile] });

      const result = await controller.findByDepartment('dept-1', '1', '20', 'false', 'u1', null);

      expect(result.data).toHaveLength(1);
      expect(mockFilesService.findByDepartment).toHaveBeenCalledWith(
        'dept-1', 'u1', null, 1, 20, false
      );
    });
  });
});
