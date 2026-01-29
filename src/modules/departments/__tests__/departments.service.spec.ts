import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DepartmentsService } from '../departments.service';
import { PrismaService } from '../../../database/prisma.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  const mockCompany = {
    id: 'company-id',
    name: 'Test Company',
    isActive: true,
  };

  const mockDepartment = {
    id: 'dept-id',
    companyId: 'company-id',
    name: 'Marketing',
    slug: 'marketing',
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
  };

  const mockDefaultDepartment = {
    ...mockDepartment,
    id: 'default-dept-id',
    name: 'Umumiy chat',
    slug: 'general-chat',
    isDefault: true,
  };

  const mockUser = {
    id: 'user-id',
    username: 'testuser',
    name: 'Test User',
    avatar: null,
    role: 'EMPLOYEE',
    workerType: { id: 'wt-id', name: 'Buxgalter' },
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userCompany: {
      findFirst: jest.fn(),
    },
    operatorCompany: {
      findFirst: jest.fn(),
    },
    departmentMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a department', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.department.findUnique.mockResolvedValue(null);
      mockPrismaService.department.create.mockResolvedValue(mockDepartment);

      const result = await service.create('company-id', { name: 'Marketing' });

      expect(result.name).toBe('Marketing');
      expect(mockPrismaService.department.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-id',
          name: 'Marketing',
          slug: 'marketing',
          isDefault: false,
        },
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(
        service.create('invalid', { name: 'Marketing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if department exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);

      await expect(
        service.create('company-id', { name: 'Marketing' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.department.findMany.mockResolvedValue([
        { ...mockDefaultDepartment, _count: { members: 5 } },
        { ...mockDepartment, _count: { members: 3 } },
      ]);

      const result = await service.findAll('company-id');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.department.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-id', isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.findAll('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a custom department', async () => {
      mockPrismaService.department.findFirst
        .mockResolvedValueOnce(mockDepartment)
        .mockResolvedValueOnce(null);
      mockPrismaService.department.update.mockResolvedValue({
        ...mockDepartment,
        name: 'Sales',
        slug: 'sales',
      });

      const result = await service.update('company-id', 'dept-id', {
        name: 'Sales',
      });

      expect(result.name).toBe('Sales');
    });

    it('should throw ForbiddenException for default department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(
        mockDefaultDepartment,
      );

      await expect(
        service.update('company-id', 'default-dept-id', { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if department not found', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(null);

      await expect(
        service.update('company-id', 'invalid', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a custom department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.department.update.mockResolvedValue({
        ...mockDepartment,
        isActive: false,
      });

      const result = await service.remove('company-id', 'dept-id');

      expect(result.message).toBe('Department deleted successfully');
    });

    it('should throw ForbiddenException for default department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(
        mockDefaultDepartment,
      );

      await expect(
        service.remove('company-id', 'default-dept-id'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMember', () => {
    it('should add a member to department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.userCompany.findFirst.mockResolvedValue({
        id: 'uc-id',
      });
      mockPrismaService.operatorCompany.findFirst.mockResolvedValue(null);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue(null);
      mockPrismaService.departmentMember.create.mockResolvedValue({});
      mockPrismaService.departmentMember.findMany.mockResolvedValue([
        { user: mockUser, createdAt: new Date() },
      ]);

      const result = await service.addMember('company-id', 'dept-id', {
        userId: 'user-id',
      });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.departmentMember.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not in company', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.userCompany.findFirst.mockResolvedValue(null);
      mockPrismaService.operatorCompany.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember('company-id', 'dept-id', { userId: 'user-id' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if already a member', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.userCompany.findFirst.mockResolvedValue({
        id: 'uc-id',
      });
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({
        id: 'dm-id',
      });

      await expect(
        service.addMember('company-id', 'dept-id', { userId: 'user-id' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({
        id: 'dm-id',
      });
      mockPrismaService.departmentMember.delete.mockResolvedValue({});

      const result = await service.removeMember(
        'company-id',
        'dept-id',
        'user-id',
      );

      expect(result.message).toBe('Member removed successfully');
    });

    it('should throw NotFoundException if member not found', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('company-id', 'dept-id', 'user-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMembers', () => {
    it('should return all members of a department', async () => {
      mockPrismaService.department.findFirst.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findMany.mockResolvedValue([
        { user: mockUser, createdAt: new Date() },
      ]);

      const result = await service.getMembers('company-id', 'dept-id');

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
    });
  });
});
