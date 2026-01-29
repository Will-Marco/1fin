import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from '../departments.controller';
import { DepartmentsService } from '../departments.service';

describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let service: DepartmentsService;

  const mockDepartment = {
    id: 'dept-id',
    name: 'Marketing',
    slug: 'marketing',
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
  };

  const mockMember = {
    id: 'user-id',
    username: 'testuser',
    name: 'Test User',
    avatar: null,
    role: 'EMPLOYEE',
    joinedAt: new Date(),
  };

  const mockDepartmentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    getMembers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        { provide: DepartmentsService, useValue: mockDepartmentsService },
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    service = module.get<DepartmentsService>(DepartmentsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department', async () => {
      mockDepartmentsService.create.mockResolvedValue(mockDepartment);

      const result = await controller.create('company-id', { name: 'Marketing' });

      expect(result).toEqual(mockDepartment);
      expect(service.create).toHaveBeenCalledWith('company-id', {
        name: 'Marketing',
      });
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      mockDepartmentsService.findAll.mockResolvedValue([mockDepartment]);

      const result = await controller.findAll('company-id');

      expect(result).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith('company-id');
    });
  });

  describe('findOne', () => {
    it('should return a department', async () => {
      mockDepartmentsService.findOne.mockResolvedValue(mockDepartment);

      const result = await controller.findOne('company-id', 'dept-id');

      expect(result).toEqual(mockDepartment);
      expect(service.findOne).toHaveBeenCalledWith('company-id', 'dept-id');
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      const updated = { ...mockDepartment, name: 'Sales' };
      mockDepartmentsService.update.mockResolvedValue(updated);

      const result = await controller.update('company-id', 'dept-id', {
        name: 'Sales',
      });

      expect(result.name).toBe('Sales');
      expect(service.update).toHaveBeenCalledWith('company-id', 'dept-id', {
        name: 'Sales',
      });
    });
  });

  describe('remove', () => {
    it('should delete a department', async () => {
      mockDepartmentsService.remove.mockResolvedValue({
        message: 'Department deleted successfully',
      });

      const result = await controller.remove('company-id', 'dept-id');

      expect(result.message).toBe('Department deleted successfully');
      expect(service.remove).toHaveBeenCalledWith('company-id', 'dept-id');
    });
  });

  describe('addMember', () => {
    it('should add a member to department', async () => {
      mockDepartmentsService.addMember.mockResolvedValue([mockMember]);

      const result = await controller.addMember('company-id', 'dept-id', {
        userId: 'user-id',
      });

      expect(result).toHaveLength(1);
      expect(service.addMember).toHaveBeenCalledWith('company-id', 'dept-id', {
        userId: 'user-id',
      });
    });
  });

  describe('removeMember', () => {
    it('should remove a member from department', async () => {
      mockDepartmentsService.removeMember.mockResolvedValue({
        message: 'Member removed successfully',
      });

      const result = await controller.removeMember(
        'company-id',
        'dept-id',
        'user-id',
      );

      expect(result.message).toBe('Member removed successfully');
      expect(service.removeMember).toHaveBeenCalledWith(
        'company-id',
        'dept-id',
        'user-id',
      );
    });
  });

  describe('getMembers', () => {
    it('should return all members of a department', async () => {
      mockDepartmentsService.getMembers.mockResolvedValue([mockMember]);

      const result = await controller.getMembers('company-id', 'dept-id');

      expect(result).toHaveLength(1);
      expect(service.getMembers).toHaveBeenCalledWith('company-id', 'dept-id');
    });
  });
});
