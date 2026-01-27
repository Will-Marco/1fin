import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../database/prisma.service';
import { Role } from '../../../../generated/prisma/client';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: 'user-id',
    username: 'operator01',
    name: 'Operator User',
    phone: '+998901234567',
    avatar: null,
    role: Role.OPERATOR,
    isActive: true,
    mustChangePassword: true,
    workerType: { id: 'wt-id', name: 'Buxgalter' },
    userCompanies: [],
    operatorCompanies: [],
    createdAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    workerType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    userCompany: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    operatorCompany: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      username: 'operator01',
      name: 'Operator User',
      role: Role.OPERATOR,
      workerTypeId: 'wt-id',
    };

    it('should create a user with default password', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      mockPrismaService.workerType.findUnique.mockResolvedValue({
        id: 'wt-id',
        name: 'Buxgalter',
        isActive: true,
      });
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-1fin123');

      const result = await service.create(createDto, Role.ADMIN);

      expect(result.username).toBe('operator01');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'operator01',
          mustChangePassword: true,
        }),
      });
    });

    it('should throw ForbiddenException when creating SUPER_ADMIN', async () => {
      const dto = { ...createDto, role: Role.SUPER_ADMIN };
      await expect(service.create(dto, Role.ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when ADMIN creates ADMIN', async () => {
      const dto = { ...createDto, role: Role.ADMIN };
      await expect(service.create(dto, Role.ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow SUPER_ADMIN to create ADMIN', async () => {
      const dto = {
        username: 'admin01',
        name: 'Admin',
        role: Role.ADMIN,
      };
      const adminUser = { ...mockUser, role: Role.ADMIN, workerType: null };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(adminUser);
      mockPrismaService.user.create.mockResolvedValue(adminUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      const result = await service.create(dto, Role.SUPER_ADMIN);

      expect(result.role).toBe(Role.ADMIN);
    });

    it('should throw ConflictException if username exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(createDto, Role.ADMIN)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if OPERATOR has no workerTypeId', async () => {
      const dto = { username: 'op01', name: 'Op', role: Role.OPERATOR };
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, Role.ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by role', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.findAll(1, 20, Role.OPERATOR);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: Role.OPERATOR }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-id');

      expect(result.username).toBe('operator01');
    });

    it('should throw NotFoundException', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.remove('user-id');

      expect(result.message).toBe('User deleted successfully');
    });

    it('should throw ForbiddenException when deleting SUPER_ADMIN', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        role: Role.SUPER_ADMIN,
      });

      await expect(service.remove('user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assignCompany', () => {
    const company = { id: 'company-id', name: 'Test', isActive: true };

    it('should assign OPERATOR to company', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);
      mockPrismaService.company.findUnique.mockResolvedValue(company);
      mockPrismaService.operatorCompany.findUnique.mockResolvedValue(null);
      mockPrismaService.operatorCompany.create.mockResolvedValue({});

      await service.assignCompany('user-id', { companyId: 'company-id' });

      expect(mockPrismaService.operatorCompany.create).toHaveBeenCalled();
    });

    it('should assign FOUNDER to company', async () => {
      const founderUser = { ...mockUser, role: Role.FOUNDER };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(founderUser)
        .mockResolvedValueOnce(founderUser);
      mockPrismaService.company.findUnique.mockResolvedValue(company);
      mockPrismaService.userCompany.findUnique.mockResolvedValue(null);
      mockPrismaService.userCompany.create.mockResolvedValue({});

      await service.assignCompany('user-id', { companyId: 'company-id' });

      expect(mockPrismaService.userCompany.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if DIRECTOR already has company', async () => {
      const directorUser = { ...mockUser, role: Role.DIRECTOR };
      mockPrismaService.user.findUnique.mockResolvedValue(directorUser);
      mockPrismaService.company.findUnique.mockResolvedValue(company);
      mockPrismaService.userCompany.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.assignCompany('user-id', { companyId: 'company-id' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for SUPER_ADMIN/ADMIN', async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.company.findUnique.mockResolvedValue(company);

      await expect(
        service.assignCompany('user-id', { companyId: 'company-id' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unassignCompany', () => {
    it('should unassign OPERATOR from company', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.operatorCompany.findUnique.mockResolvedValue({
        id: 'oc-id',
      });
      mockPrismaService.operatorCompany.delete.mockResolvedValue({});

      await service.unassignCompany('user-id', 'company-id');

      expect(mockPrismaService.operatorCompany.delete).toHaveBeenCalledWith({
        where: { id: 'oc-id' },
      });
    });

    it('should throw NotFoundException if assignment not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.operatorCompany.findUnique.mockResolvedValue(null);

      await expect(
        service.unassignCompany('user-id', 'company-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createWorkerType', () => {
    it('should create a worker type', async () => {
      mockPrismaService.workerType.findUnique.mockResolvedValue(null);
      mockPrismaService.workerType.create.mockResolvedValue({
        id: 'wt-new',
        name: 'Yurist',
        isActive: true,
        createdAt: new Date(),
      });

      const result = await service.createWorkerType({ name: 'Yurist' });

      expect(result.name).toBe('Yurist');
      expect(mockPrismaService.workerType.create).toHaveBeenCalledWith({
        data: { name: 'Yurist' },
      });
    });

    it('should throw ConflictException if name already exists', async () => {
      mockPrismaService.workerType.findUnique.mockResolvedValue({
        id: 'wt-existing',
        name: 'Buxgalter',
      });

      await expect(
        service.createWorkerType({ name: 'Buxgalter' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllWorkerTypes', () => {
    it('should return all active worker types', async () => {
      const workerTypes = [
        { id: 'wt-1', name: 'Buxgalter', isActive: true, createdAt: new Date() },
        { id: 'wt-2', name: 'Yurist', isActive: true, createdAt: new Date() },
      ];
      mockPrismaService.workerType.findMany.mockResolvedValue(workerTypes);

      const result = await service.findAllWorkerTypes();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.workerType.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      });
    });
  });

  describe('removeWorkerType', () => {
    it('should soft delete a worker type', async () => {
      mockPrismaService.workerType.findUnique.mockResolvedValue({
        id: 'wt-id',
        name: 'Buxgalter',
      });
      mockPrismaService.workerType.update.mockResolvedValue({
        id: 'wt-id',
        isActive: false,
      });

      const result = await service.removeWorkerType('wt-id');

      expect(result.message).toBe('Worker type deleted successfully');
      expect(mockPrismaService.workerType.update).toHaveBeenCalledWith({
        where: { id: 'wt-id' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if worker type not found', async () => {
      mockPrismaService.workerType.findUnique.mockResolvedValue(null);

      await expect(service.removeWorkerType('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
