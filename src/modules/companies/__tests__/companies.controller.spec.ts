import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyRole } from '../../../../generated/prisma/client';
import { CompaniesController } from '../companies.controller';
import { CompaniesService } from '../companies.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-id',
    name: 'Tech Solutions LLC',
    inn: '123456789',
    isActive: true,
    departmentConfigs: [],
    _count: { memberships: 0 },
  };

  const mockCompaniesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateLogo: jest.fn(),
    getDepartmentConfigs: jest.fn(),
    enableDepartment: jest.fn(),
    disableDepartment: jest.fn(),
    getMembers: jest.fn(),
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
      mockCompaniesService.create.mockResolvedValue(mockCompany);

      const result = await controller.create(
        { name: 'Tech Solutions LLC', inn: '123456789' },
        'user-id',
      );

      expect(result).toEqual(mockCompany);
      expect(service.create).toHaveBeenCalledWith(
        { name: 'Tech Solutions LLC', inn: '123456789' },
        'user-id',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated companies', async () => {
      const paginated = {
        data: [mockCompany],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockCompaniesService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll('1', '20', undefined);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('findOne', () => {
    it('should return a company', async () => {
      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const result = await controller.findOne('company-id');

      expect(result).toEqual(mockCompany);
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      mockCompaniesService.update.mockResolvedValue({
        ...mockCompany,
        name: 'Updated',
      });

      const result = await controller.update('company-id', { name: 'Updated' });

      expect(service.update).toHaveBeenCalledWith('company-id', { name: 'Updated' });
    });
  });

  describe('remove', () => {
    it('should deactivate a company', async () => {
      mockCompaniesService.remove.mockResolvedValue({
        message: "Kompaniya o'chirildi",
      });

      const result = await controller.remove('company-id');

      expect(result.message).toBeDefined();
    });
  });

  describe('getDepartmentConfigs', () => {
    it('should return department configs', async () => {
      mockCompaniesService.getDepartmentConfigs.mockResolvedValue([]);

      const result = await controller.getDepartmentConfigs('company-id');

      expect(service.getDepartmentConfigs).toHaveBeenCalledWith('company-id');
    });
  });

  describe('enableDepartment', () => {
    it('should enable a department', async () => {
      const config = { id: 'cfg-id', isEnabled: true, globalDepartment: {} };
      mockCompaniesService.enableDepartment.mockResolvedValue(config);

      const result = await controller.enableDepartment('company-id', 'dept-id');

      expect(result.isEnabled).toBe(true);
      expect(service.enableDepartment).toHaveBeenCalledWith('company-id', 'dept-id');
    });
  });

  describe('disableDepartment', () => {
    it('should disable a department', async () => {
      const config = { id: 'cfg-id', isEnabled: false, globalDepartment: {} };
      mockCompaniesService.disableDepartment.mockResolvedValue(config);

      const result = await controller.disableDepartment('company-id', 'dept-id');

      expect(result.isEnabled).toBe(false);
    });
  });

  describe('getMembers', () => {
    it('should return company members', async () => {
      const members = [
        {
          id: 'mem-1',
          companyRole: CompanyRole.CLIENT_DIRECTOR,
          user: { name: 'Bobur' },
          allowedDepartments: [],
        },
      ];
      mockCompaniesService.getMembers.mockResolvedValue(members);

      const result = await controller.getMembers('company-id');

      expect(result).toHaveLength(1);
      expect(service.getMembers).toHaveBeenCalledWith('company-id');
    });
  });
});
