import {
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CompaniesService } from '../companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-id',
    name: 'Tech Solutions LLC',
    inn: '123456789',
    logo: null,
    address: 'Tashkent',
    requisites: null,
    isActive: true,
    createdById: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    departmentConfigs: [],
    _count: { memberships: 0 },
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    globalDepartment: {
      findMany: jest.fn(),
    },
    companyDepartmentConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    userCompanyMembership: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create a company and link global departments', async () => {
      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(null)       // INN check
        .mockResolvedValueOnce(mockCompany); // findOne
      mockPrismaService.globalDepartment.findMany.mockResolvedValue([
        { id: 'dept-1' },
        { id: 'dept-2' },
      ]);
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn({
          company: { create: jest.fn().mockResolvedValue(mockCompany) },
          companyDepartmentConfig: { createMany: jest.fn().mockResolvedValue({}) },
        });
      });

      const result = await service.create(
        { name: 'Tech Solutions LLC', inn: '123456789' },
        'user-id',
      );

      expect(result.name).toBe('Tech Solutions LLC');
    });

    it('should throw ConflictException if INN already exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ name: 'Test', inn: '123456789' }, 'user-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated companies', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([mockCompany]);
      mockPrismaService.company.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([]);
      mockPrismaService.company.count.mockResolvedValue(0);

      await service.findAll(1, 20, 'Tech');

      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a company with department configs', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.findOne('company-id');

      expect(result.name).toBe('Tech Solutions LLC');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if inactive', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        ...mockCompany,
        isActive: false,
      });

      await expect(service.findOne('company-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update company info', async () => {
      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(mockCompany)  // first findOne
        .mockResolvedValueOnce({ ...mockCompany, name: 'Updated' }); // second findOne
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.update('company-id', { name: 'Updated' });

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: { name: 'Updated' },
      });
    });
  });

  // ─────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────

  describe('remove', () => {
    it('should soft-delete company', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.remove('company-id');

      expect(result.message).toBe("Kompaniya o'chirildi");
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: { isActive: false },
      });
    });
  });

  // ─────────────────────────────────────────────
  // enableDepartment / disableDepartment
  // ─────────────────────────────────────────────

  describe('enableDepartment', () => {
    it('should enable an existing config', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        id: 'config-id',
        isEnabled: false,
      });
      mockPrismaService.companyDepartmentConfig.update.mockResolvedValue({
        id: 'config-id',
        isEnabled: true,
        globalDepartment: { id: 'dept-1', name: 'Umumiy chat', slug: 'general-chat' },
      });

      const result = await service.enableDepartment('company-id', 'dept-1');

      expect(result.isEnabled).toBe(true);
    });

    it('should create config if not exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.companyDepartmentConfig.create.mockResolvedValue({
        id: 'new-config',
        isEnabled: true,
        globalDepartment: { id: 'dept-new', name: 'New', slug: 'new' },
      });

      const result = await service.enableDepartment('company-id', 'dept-new');

      expect(mockPrismaService.companyDepartmentConfig.create).toHaveBeenCalled();
    });
  });

  describe('disableDepartment', () => {
    it('should disable an existing config', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        id: 'config-id',
        isEnabled: true,
      });
      mockPrismaService.companyDepartmentConfig.update.mockResolvedValue({
        id: 'config-id',
        isEnabled: false,
        globalDepartment: { id: 'dept-1', name: 'Chat', slug: 'chat' },
      });

      const result = await service.disableDepartment('company-id', 'dept-1');

      expect(result.isEnabled).toBe(false);
    });

    it('should throw NotFoundException if config not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.disableDepartment('company-id', 'invalid-dept'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // getMembers
  // ─────────────────────────────────────────────

  describe('getMembers', () => {
    it('should return active members with roles', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([
        {
          id: 'mem-1',
          rank: null,
          isActive: true,
          createdAt: new Date(),
          user: {
            id: 'u-1',
            username: 'director01',
            name: 'Bobur',
            systemRole: SystemRole.CLIENT_DIRECTOR,
          },
          allowedDepartments: [],
        },
      ]);

      const result = await service.getMembers('company-id');

      expect(result).toHaveLength(1);
      expect(result[0].user.systemRole).toBe(SystemRole.CLIENT_DIRECTOR);
    });
  });

  // ─────────────────────────────────────────────
  // findAllDeleted
  // ─────────────────────────────────────────────

  describe('findAllDeleted', () => {
    const mockDeletedCompany = {
      ...mockCompany,
      isActive: false,
    };

    it('should return paginated deleted companies', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([mockDeletedCompany]);
      mockPrismaService.company.count.mockResolvedValue(1);

      const result = await service.findAllDeleted(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].isActive).toBe(false);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('should filter by search term', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([]);
      mockPrismaService.company.count.mockResolvedValue(0);

      await service.findAllDeleted(1, 20, 'Tech');

      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // restore
  // ─────────────────────────────────────────────

  describe('restore', () => {
    const mockDeletedCompany = {
      ...mockCompany,
      isActive: false,
    };

    it('should restore a soft-deleted company', async () => {
      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(mockDeletedCompany)  // first check
        .mockResolvedValueOnce({ ...mockCompany, isActive: true }); // findOne after restore
      mockPrismaService.company.update.mockResolvedValue({});

      const result = await service.restore('company-id');

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.restore('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if company is already active', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany); // isActive: true

      await expect(service.restore('company-id')).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // permanentDelete
  // ─────────────────────────────────────────────

  describe('permanentDelete', () => {
    const mockDeletedCompany = {
      ...mockCompany,
      isActive: false,
    };

    it('should permanently delete a soft-deleted company', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockDeletedCompany);
      mockPrismaService.company.delete.mockResolvedValue({});

      const result = await service.permanentDelete('company-id');

      expect(mockPrismaService.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-id' },
      });
      expect(result.message).toBe("Kompaniya butunlay o'chirildi");
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.permanentDelete('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if company is still active', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany); // isActive: true

      await expect(service.permanentDelete('company-id')).rejects.toThrow(ConflictException);
    });
  });
});
