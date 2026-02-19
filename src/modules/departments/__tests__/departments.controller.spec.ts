import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from '../departments.controller';
import { DepartmentsService } from '../departments.service';

describe('DepartmentsController (GlobalDepartment)', () => {
  let controller: DepartmentsController;
  let service: DepartmentsService;

  const mockDept = {
    id: 'dept-id',
    name: "Bank to'lovlari",
    slug: 'bank-payment',
    isActive: true,
    createdAt: new Date(),
    _count: { companyConfigs: 3 },
  };

  const mockDeptService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        { provide: DepartmentsService, useValue: mockDeptService },
        Reflector,
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    service = module.get<DepartmentsService>(DepartmentsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a global department', async () => {
      mockDeptService.create.mockResolvedValue(mockDept);

      const result = await controller.create({ name: "Bank to'lovlari" });

      expect(result).toEqual(mockDept);
      expect(service.create).toHaveBeenCalledWith({ name: "Bank to'lovlari" });
    });
  });

  describe('findAll', () => {
    it('should return active departments', async () => {
      mockDeptService.findAll.mockResolvedValue([mockDept]);

      const result = await controller.findAll(undefined);

      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith(false);
    });

    it('should include inactive when query param is true', async () => {
      mockDeptService.findAll.mockResolvedValue([mockDept]);

      await controller.findAll('true');

      expect(service.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('findOne', () => {
    it('should return a department', async () => {
      mockDeptService.findOne.mockResolvedValue(mockDept);

      const result = await controller.findOne('dept-id');

      expect(result).toEqual(mockDept);
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      mockDeptService.update.mockResolvedValue({ ...mockDept, name: 'Updated' });

      const result = await controller.update('dept-id', { name: 'Updated' });

      expect(service.update).toHaveBeenCalledWith('dept-id', { name: 'Updated' });
    });
  });

  describe('deactivate', () => {
    it('should deactivate a department', async () => {
      mockDeptService.deactivate.mockResolvedValue({
        message: "Global department o'chirildi",
      });

      const result = await controller.deactivate('dept-id');

      expect(result.message).toBeDefined();
      expect(service.deactivate).toHaveBeenCalledWith('dept-id');
    });
  });
});
