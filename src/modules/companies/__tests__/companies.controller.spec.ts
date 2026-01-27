import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesController } from '../companies.controller';
import { CompaniesService } from '../companies.service';
import { Reflector } from '@nestjs/core';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-id',
    name: 'Tech Solutions',
    inn: '123456789',
    logo: null,
    address: 'Tashkent',
    isActive: true,
    departments: [],
    _count: { userCompanies: 0, operatorCompanies: 0 },
  };

  const mockCompaniesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateLogo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        { provide: CompaniesService, useValue: mockCompaniesService },
        Reflector,
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
    service = module.get<CompaniesService>(CompaniesService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a company', async () => {
      const dto = { name: 'Tech Solutions', inn: '123456789' };
      mockCompaniesService.create.mockResolvedValue(mockCompany);

      const result = await controller.create(dto, 'admin-id');

      expect(result).toEqual(mockCompany);
      expect(service.create).toHaveBeenCalledWith(dto, 'admin-id');
    });
  });

  describe('findAll', () => {
    it('should return paginated companies', async () => {
      const paginatedResult = {
        data: [mockCompany],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockCompaniesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll('1', '20');

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('should use default pagination when params not provided', async () => {
      const paginatedResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockCompaniesService.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll(undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('findOne', () => {
    it('should return a company by ID', async () => {
      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const result = await controller.findOne('company-id');

      expect(result).toEqual(mockCompany);
      expect(service.findOne).toHaveBeenCalledWith('company-id');
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      const dto = { name: 'Updated Name' };
      const updated = { ...mockCompany, name: 'Updated Name' };
      mockCompaniesService.update.mockResolvedValue(updated);

      const result = await controller.update('company-id', dto);

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith('company-id', dto);
    });
  });

  describe('remove', () => {
    it('should soft delete a company', async () => {
      const deleteResult = { message: 'Company deleted successfully' };
      mockCompaniesService.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove('company-id');

      expect(result).toEqual(deleteResult);
      expect(service.remove).toHaveBeenCalledWith('company-id');
    });
  });

  describe('uploadLogo', () => {
    it('should upload company logo', async () => {
      const updatedCompany = { ...mockCompany, logo: '/uploads/logos/test.jpg' };
      mockCompaniesService.updateLogo.mockResolvedValue(updatedCompany);

      const mockFile = { filename: 'test.jpg' } as Express.Multer.File;

      const result = await controller.uploadLogo('company-id', mockFile);

      expect(result).toEqual(updatedCompany);
      expect(service.updateLogo).toHaveBeenCalledWith(
        'company-id',
        '/uploads/logos/test.jpg',
      );
    });
  });
});
