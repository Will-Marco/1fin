import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UsersService } from '../users.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    id: 'user-id',
    username: 'fin_employee01',
    name: 'Ali Valiyev',
    phone: '+998901234567',
    avatar: null,
    systemRole: SystemRole.FIN_EMPLOYEE,
    notificationsEnabled: true,
    isActive: true,
    mustChangePassword: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    memberships: [],
  };

  const mockClientUser = {
    ...mockUser,
    id: 'client-user-id',
    username: 'client_director01',
    systemRole: SystemRole.CLIENT_DIRECTOR,
    memberships: [],
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    userCompanyMembership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    membershipDepartmentAccess: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    companyDepartmentConfig: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DEFAULT_USER_PASSWORD') return '1Fin@2024';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // createSystemUser
  // ─────────────────────────────────────────────

  describe('createSystemUser', () => {
    const dto = {
      username: 'fin_employee01',
      name: 'Ali Valiyev',
      systemRole: SystemRole.FIN_EMPLOYEE,
    };

    it('should create a system user with default password', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)       // username check
        .mockResolvedValueOnce(mockUser);  // findOne
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.createSystemUser(dto);

      expect(result.username).toBe('fin_employee01');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'fin_employee01',
          systemRole: SystemRole.FIN_EMPLOYEE,
          mustChangePassword: true,
        }),
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createSystemUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // createClientUser
  // ─────────────────────────────────────────────

  describe('createClientUser', () => {
    const dto = {
      username: 'client_director01',
      name: 'Bobur Toshmatov',
      systemRole: SystemRole.CLIENT_DIRECTOR,
    };

    it('should create a client user with systemRole', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockClientUser);
      mockPrismaService.user.create.mockResolvedValue(mockClientUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.createClientUser(dto);

      expect(result.systemRole).toBe(SystemRole.CLIENT_DIRECTOR);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'client_director01',
          systemRole: SystemRole.CLIENT_DIRECTOR,
          mustChangePassword: true,
        }),
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.createClientUser(dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('should filter by hasSystemRole=true (1FIN staff)', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 20, { hasSystemRole: true });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ systemRole: { not: null } }),
        }),
      );
    });

    it('should filter by hasSystemRole=false (client users)', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockClientUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 20, { hasSystemRole: false });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ systemRole: null }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user with memberships', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-id');

      expect(result.username).toBe('fin_employee01');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update user info', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({ ...mockUser, name: 'Updated Name' });
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.update('user-id', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { name: 'Updated Name' },
      });
    });
  });

  // ─────────────────────────────────────────────
  // deactivate
  // ─────────────────────────────────────────────

  describe('deactivate', () => {
    it('should soft-delete user and deactivate memberships', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.$transaction.mockResolvedValue([]);

      const result = await service.deactivate('user-id');

      expect(result.message).toBe("Foydalanuvchi o'chirildi");
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // assignMembership
  // ─────────────────────────────────────────────

  describe('assignMembership', () => {
    const dto = {
      companyId: 'company-id',
      rank: 1,
      allowedDepartmentIds: ['dept-id-1'],
    };

    const mockMembership = {
      id: 'membership-id',
      rank: 1,
      isActive: true,
      company: { id: 'company-id', name: 'Test Company' },
      allowedDepartments: [],
    };

    it('should create a membership', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'company-id',
        name: 'Test',
        isActive: true,
      });
      mockPrismaService.companyDepartmentConfig.findMany.mockResolvedValue([
        { globalDepartmentId: 'dept-id-1' },
      ]);
      mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue(null);
      mockPrismaService.userCompanyMembership.create.mockResolvedValue(mockMembership);

      const result = await service.assignMembership('user-id', dto);

      expect(result.rank).toBe(1);
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.assignMembership('user-id', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if user already in company', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'company-id',
        isActive: true,
      });
      mockPrismaService.companyDepartmentConfig.findMany.mockResolvedValue([
        { globalDepartmentId: 'dept-id-1' },
      ]);
      mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue({
        id: 'existing-membership',
      });

      await expect(service.assignMembership('user-id', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if department IDs are invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.company.findUnique.mockResolvedValue({
        id: 'company-id',
        isActive: true,
      });
      // Returns empty array — none of the dept IDs match
      mockPrismaService.companyDepartmentConfig.findMany.mockResolvedValue([]);

      await expect(service.assignMembership('user-id', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // updateMembership
  // ─────────────────────────────────────────────

  describe('updateMembership', () => {
    it('should update membership via transaction', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'membership-id',
        userId: 'user-id',
        companyId: 'company-id',
        user: { systemRole: SystemRole.FIN_EMPLOYEE },
      });
      mockPrismaService.companyDepartmentConfig.findMany.mockResolvedValue([
        { globalDepartmentId: 'dept-id-2' },
      ]);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.updateMembership('user-id', 'membership-id', {
        rank: 2,
        allowedDepartmentIds: ['dept-id-2'],
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if membership not found', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMembership('user-id', 'bad-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // removeMembership
  // ─────────────────────────────────────────────

  describe('removeMembership', () => {
    it('should delete a membership', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'membership-id',
        userId: 'user-id',
      });
      mockPrismaService.userCompanyMembership.delete.mockResolvedValue({});

      const result = await service.removeMembership('user-id', 'membership-id');

      expect(result.message).toBe("Membership o'chirildi");
      expect(mockPrismaService.userCompanyMembership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-id' },
      });
    });

    it('should throw NotFoundException if membership not found', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMembership('user-id', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
