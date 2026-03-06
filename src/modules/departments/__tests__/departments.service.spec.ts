import {
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { DepartmentsService } from '../departments.service';

describe('DepartmentsService (GlobalDepartment)', () => {
  let service: DepartmentsService;

  const mockDept = {
    id: 'dept-id',
    name: "Bank to'lovlari",
    slug: 'bank-payment',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { companyConfigs: 3 },
  };

  const mockPrismaService = {
    globalDepartment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    companyDepartmentConfig: {
      findMany: jest.fn(),
    },
    userCompanyMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userDepartmentRead: {
      findMany: jest.fn(),
    },
    message: {
      count: jest.fn(),
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

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create a global department with auto-generated slug', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(null);
      mockPrismaService.globalDepartment.create.mockResolvedValue(mockDept);

      const result = await service.create({ name: "Bank to'lovlari" });

      expect(result.slug).toBe('bank-payment');
      expect(mockPrismaService.globalDepartment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Bank to'lovlari", isActive: true }),
        }),
      );
    });

    it('should use provided slug if given', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(null);
      mockPrismaService.globalDepartment.create.mockResolvedValue({
        ...mockDept,
        slug: 'custom-slug',
      });

      const result = await service.create({
        name: "Umumiy chat",
        slug: 'custom-slug',
      });

      expect(result.slug).toBe('custom-slug');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(mockDept);

      await expect(
        service.create({ name: "Bank to'lovlari" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return only active departments by default', async () => {
      mockPrismaService.globalDepartment.findMany.mockResolvedValue([mockDept]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.globalDepartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should return all including inactive when includeInactive=true', async () => {
      mockPrismaService.globalDepartment.findMany.mockResolvedValue([
        mockDept,
        { ...mockDept, id: 'dept-inactive', isActive: false },
      ]);

      const result = await service.findAll(true);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.globalDepartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a global department', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(mockDept);

      const result = await service.findOne('dept-id');

      expect(result.slug).toBe('bank-payment');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update department name', async () => {
      mockPrismaService.globalDepartment.findUnique
        .mockResolvedValueOnce(mockDept) // findOne check
        .mockResolvedValueOnce(null);    // slug uniqueness check

      mockPrismaService.globalDepartment.update.mockResolvedValue({
        ...mockDept,
        name: 'Updated Name',
        slug: 'updated-name',
      });

      const result = await service.update('dept-id', {
        name: 'Updated Name',
        slug: 'updated-name',
      });

      expect(result.slug).toBe('updated-name');
    });

    it('should throw ConflictException if new slug already taken by another dept', async () => {
      mockPrismaService.globalDepartment.findUnique
        .mockResolvedValueOnce(mockDept)                          // findOne check
        .mockResolvedValueOnce({ id: 'other-dept', slug: 'taken' }); // slug conflict

      await expect(
        service.update('dept-id', { slug: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // deactivate
  // ─────────────────────────────────────────────

  describe('deactivate', () => {
    it('should soft-delete a global department', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue(mockDept);
      mockPrismaService.globalDepartment.update.mockResolvedValue({});

      const result = await service.deactivate('dept-id');

      expect(result.message).toBe("Global department o'chirildi");
      expect(mockPrismaService.globalDepartment.update).toHaveBeenCalledWith({
        where: { id: 'dept-id' },
        data: { isActive: false },
      });
    });
  });

  // ─────────────────────────────────────────────
  // getUnreadSummary
  // ─────────────────────────────────────────────

  describe('getUnreadSummary', () => {
    const userId = 'user-1';
    const companyId = 'company-1';

    it('FIN user — should return unread counts for all enabled company departments', async () => {
      mockPrismaService.companyDepartmentConfig.findMany.mockResolvedValue([
        { globalDepartment: { id: 'dept-1', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        { globalDepartment: { id: 'dept-2', name: 'Yuridik', slug: 'yuridik' } },
      ]);
      mockPrismaService.userDepartmentRead.findMany.mockResolvedValue([
        { globalDepartmentId: 'dept-1', lastReadAt: new Date('2024-01-01') },
      ]);
      // dept-1: 3 unread after lastReadAt; dept-2: never read → 5 total
      mockPrismaService.message.count
        .mockResolvedValueOnce(3)  // dept-1
        .mockResolvedValueOnce(5); // dept-2

      const result = await service.getUnreadSummary(userId, companyId, 'FIN_DIRECTOR' as any);

      expect(result.totalUnread).toBe(8);
      expect(result.departments).toHaveLength(2);
      expect(result.departments[0]).toMatchObject({ departmentSlug: 'buxgalteriya', unreadCount: 3 });
      expect(result.departments[1]).toMatchObject({ departmentSlug: 'yuridik', unreadCount: 5 });
    });

    it('CLIENT user — should return unread counts for allowed departments only', async () => {
      mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue({
        allowedDepartments: [
          { globalDepartment: { id: 'dept-1', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ],
      });
      mockPrismaService.userDepartmentRead.findMany.mockResolvedValue([]);
      mockPrismaService.message.count.mockResolvedValueOnce(2);

      const result = await service.getUnreadSummary(userId, companyId, 'CLIENT_DIRECTOR' as any);

      expect(result.totalUnread).toBe(2);
      expect(result.departments).toHaveLength(1);
    });

    it('CLIENT user with no membership — should return empty result', async () => {
      mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue(null);

      const result = await service.getUnreadSummary(userId, companyId, 'CLIENT_EMPLOYEE' as any);

      expect(result).toEqual({ departments: [], totalUnread: 0 });
      expect(mockPrismaService.message.count).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // getAllCompaniesUnreadSummary
  // ─────────────────────────────────────────────

  describe('getAllCompaniesUnreadSummary', () => {
    const userId = 'user-1';

    it('FIN user — should aggregate unread counts across multiple companies', async () => {
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([
        { company: { id: 'company-1', name: 'Alfa LLC' } },
        { company: { id: 'company-2', name: 'Beta Corp' } },
      ]);

      // company-1: 1 department with 4 unreads
      // company-2: 1 department with 2 unreads
      mockPrismaService.companyDepartmentConfig.findMany
        .mockResolvedValueOnce([
          { globalDepartment: { id: 'dept-1', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ])
        .mockResolvedValueOnce([
          { globalDepartment: { id: 'dept-2', name: 'Yuridik', slug: 'yuridik' } },
        ]);

      mockPrismaService.userDepartmentRead.findMany.mockResolvedValue([]);
      mockPrismaService.message.count
        .mockResolvedValueOnce(4)  // company-1 / dept-1
        .mockResolvedValueOnce(2); // company-2 / dept-2

      const result = await service.getAllCompaniesUnreadSummary(userId, 'FIN_ADMIN' as any);

      expect(result.grandTotalUnread).toBe(6);
      expect(result.companies).toHaveLength(2);
      expect(result.companies[0]).toMatchObject({ companyName: 'Alfa LLC', totalUnread: 4 });
      expect(result.companies[1]).toMatchObject({ companyName: 'Beta Corp', totalUnread: 2 });
    });

    it('CLIENT user — should show only allowed departments per company', async () => {
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([
        { company: { id: 'company-1', name: 'Alfa LLC' } },
      ]);
      mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue({
        allowedDepartments: [
          { globalDepartment: { id: 'dept-1', name: 'Buxgalteriya', slug: 'buxgalteriya' } },
        ],
      });
      mockPrismaService.userDepartmentRead.findMany.mockResolvedValue([]);
      mockPrismaService.message.count.mockResolvedValueOnce(3);

      const result = await service.getAllCompaniesUnreadSummary(userId, 'CLIENT_FOUNDER' as any);

      expect(result.grandTotalUnread).toBe(3);
      expect(result.companies[0].departments).toHaveLength(1);
    });

    it('user with no memberships — should return empty companies and zero total', async () => {
      mockPrismaService.userCompanyMembership.findMany.mockResolvedValue([]);

      const result = await service.getAllCompaniesUnreadSummary(userId, 'CLIENT_EMPLOYEE' as any);

      expect(result.grandTotalUnread).toBe(0);
      expect(result.companies).toHaveLength(0);
      expect(mockPrismaService.message.count).not.toHaveBeenCalled();
    });
  });
});
