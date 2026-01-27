import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../../generated/prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 'user-id',
    username: 'operator01',
    name: 'Operator User',
    role: Role.OPERATOR,
    isActive: true,
  };

  const mockUsersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    assignCompany: jest.fn(),
    unassignCompany: jest.fn(),
    createWorkerType: jest.fn(),
    findAllWorkerTypes: jest.fn(),
    removeWorkerType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        Reflector,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto = {
        username: 'operator01',
        name: 'Operator',
        role: Role.OPERATOR,
        workerTypeId: 'wt-id',
      };
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await controller.create(dto, Role.ADMIN);

      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(dto, Role.ADMIN);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const paginated = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockUsersService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll('1', '20', Role.OPERATOR, undefined);

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(1, 20, Role.OPERATOR, undefined);
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-id');

      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const dto = { name: 'Updated' };
      mockUsersService.update.mockResolvedValue({ ...mockUser, name: 'Updated' });

      const result = await controller.update('user-id', dto);

      expect(service.update).toHaveBeenCalledWith('user-id', dto);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      mockUsersService.remove.mockResolvedValue({ message: 'User deleted successfully' });

      const result = await controller.remove('user-id');

      expect(result.message).toBe('User deleted successfully');
    });
  });

  describe('assignCompany', () => {
    it('should assign user to company', async () => {
      mockUsersService.assignCompany.mockResolvedValue(mockUser);

      const result = await controller.assignCompany('user-id', {
        companyId: 'company-id',
      });

      expect(service.assignCompany).toHaveBeenCalledWith('user-id', {
        companyId: 'company-id',
      });
    });
  });

  describe('unassignCompany', () => {
    it('should unassign user from company', async () => {
      mockUsersService.unassignCompany.mockResolvedValue(mockUser);

      const result = await controller.unassignCompany('user-id', 'company-id');

      expect(service.unassignCompany).toHaveBeenCalledWith('user-id', 'company-id');
    });
  });

  describe('createWorkerType', () => {
    it('should create a worker type', async () => {
      const workerType = { id: 'wt-id', name: 'Yurist', isActive: true };
      mockUsersService.createWorkerType.mockResolvedValue(workerType);

      const result = await controller.createWorkerType({ name: 'Yurist' });

      expect(result).toEqual(workerType);
      expect(service.createWorkerType).toHaveBeenCalledWith({ name: 'Yurist' });
    });
  });

  describe('findAllWorkerTypes', () => {
    it('should return all worker types', async () => {
      const workerTypes = [
        { id: 'wt-1', name: 'Buxgalter', isActive: true },
        { id: 'wt-2', name: 'Yurist', isActive: true },
      ];
      mockUsersService.findAllWorkerTypes.mockResolvedValue(workerTypes);

      const result = await controller.findAllWorkerTypes();

      expect(result).toHaveLength(2);
      expect(service.findAllWorkerTypes).toHaveBeenCalled();
    });
  });

  describe('removeWorkerType', () => {
    it('should delete a worker type', async () => {
      mockUsersService.removeWorkerType.mockResolvedValue({
        message: 'Worker type deleted successfully',
      });

      const result = await controller.removeWorkerType('wt-id');

      expect(result.message).toBe('Worker type deleted successfully');
      expect(service.removeWorkerType).toHaveBeenCalledWith('wt-id');
    });
  });
});
