import { ConflictException, NotFoundException } from '@nestjs/common';
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
    user: {
      findMany: jest.fn(),
    },
    membershipDepartmentAccess: {
      createMany: jest.fn(),
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
    jest.resetAllMocks(); // Full reset: clears Once queues + implementations
  });

  // ─────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────

  describe('create', () => {
    // Helper: sets up the transaction mock with full inner prisma tx object
    const setupTransaction = (txOverrides: Record<string, any> = {}) => {
      const txCompanyCreate = jest.fn().mockResolvedValue(mockCompany);
      const txDeptConfigCreateMany = jest.fn().mockResolvedValue({});
      const txMembershipCreate = jest
        .fn()
        .mockResolvedValue({ id: 'membership-id' });
      const txMembershipDeptCreateMany = jest.fn().mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation((fn) =>
        fn({
          company: { create: txCompanyCreate },
          companyDepartmentConfig: { createMany: txDeptConfigCreateMany },
          userCompanyMembership: { create: txMembershipCreate },
          membershipDepartmentAccess: {
            createMany: txMembershipDeptCreateMany,
          },
          ...txOverrides,
        }),
      );

      return {
        txCompanyCreate,
        txDeptConfigCreateMany,
        txMembershipCreate,
        txMembershipDeptCreateMany,
      };
    };

    beforeEach(() => {
      // Permanent fallback for findOne — individual tests add Once values for INN check
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.globalDepartment.findMany.mockResolvedValue([
        { id: 'dept-1' },
        { id: 'dept-2' },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
    });

    it('should create a company without members and return empty skippedUserIds', async () => {
      // INN is provided → queue null for INN check (not found = can create)
      mockPrismaService.company.findUnique.mockResolvedValueOnce(null);
      setupTransaction();

      const result = await service.create(
        { name: 'Tech Solutions LLC', inn: '123456789' },
        'user-id',
      );

      expect(result.name).toBe('Tech Solutions LLC');
      expect(result.skippedUserIds).toEqual([]);
    });

    it('should throw ConflictException if INN already exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValueOnce({
        id: 'existing',
      });

      await expect(
        service.create({ name: 'Test', inn: '123456789' }, 'user-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should attach valid members with allowedDepartments in the transaction', async () => {
      const { txMembershipCreate, txMembershipDeptCreateMany } =
        setupTransaction();

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-a' },
        { id: 'user-b' },
      ]);

      await service.create(
        {
          name: 'Tech Solutions LLC',
          members: [
            {
              userId: 'user-a',
              rank: 1,
              allowedDepartmentIds: ['dept-1', 'dept-2'],
            },
            { userId: 'user-b', allowedDepartmentIds: [] },
          ],
        },
        'creator-id',
      );

      expect(txMembershipCreate).toHaveBeenCalledTimes(2);
      // user-a has 2 dept IDs → createMany called once
      expect(txMembershipDeptCreateMany).toHaveBeenCalledTimes(1);
      expect(txMembershipDeptCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ globalDepartmentId: 'dept-1' }),
            expect.objectContaining({ globalDepartmentId: 'dept-2' }),
          ]),
        }),
      );
    });

    it('should skip users that are not found and report them in skippedUserIds', async () => {
      setupTransaction();

      // Only user-a exists; user-ghost does not
      mockPrismaService.user.findMany.mockResolvedValue([{ id: 'user-a' }]);

      const result = await service.create(
        {
          name: 'Tech Solutions LLC',
          members: [
            { userId: 'user-a', allowedDepartmentIds: [] },
            { userId: 'user-ghost', allowedDepartmentIds: [] },
          ],
        },
        'creator-id',
      );

      expect(result.skippedUserIds).toEqual(['user-ghost']);
    });

    it('should skip all members if none are found and return all IDs as skipped', async () => {
      setupTransaction();
      mockPrismaService.user.findMany.mockResolvedValue([]); // nobody found

      const result = await service.create(
        {
          name: 'Tech Solutions LLC',
          members: [
            { userId: 'ghost-1', allowedDepartmentIds: [] },
            { userId: 'ghost-2', allowedDepartmentIds: [] },
          ],
        },
        'creator-id',
      );

      expect(result.skippedUserIds).toEqual(['ghost-1', 'ghost-2']);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all companies for 1FIN user', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([mockCompany]);
      mockPrismaService.company.count.mockResolvedValue(1);

      const result = await service.findAll(
        'user-id',
        SystemRole.FIN_ADMIN, // 1FIN user
        1,
        20,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      // Should NOT filter by membership
      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('should return only membership companies for Client user', async () => {
      const clientCompany = {
        ...mockCompany,
        memberships: [{ _count: { allowedDepartments: 3 } }],
      };
      mockPrismaService.company.findMany.mockResolvedValue([clientCompany]);
      mockPrismaService.company.count.mockResolvedValue(1);

      const result = await service.findAll(
        'client-user-id',
        SystemRole.CLIENT_DIRECTOR, // Client user
        1,
        20,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0]._count.departmentConfigs).toBe(3);
      // Should filter by membership
      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            memberships: {
              some: {
                userId: 'client-user-id',
                isActive: true,
              },
            },
          }),
        }),
      );
    });

    it('should filter by search term for 1FIN user', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([]);
      mockPrismaService.company.count.mockResolvedValue(0);

      await service.findAll('user-id', SystemRole.FIN_ADMIN, 1, 20, 'Tech');

      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('should filter by search term for Client user with membership filter', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([]);
      mockPrismaService.company.count.mockResolvedValue(0);

      await service.findAll('client-user-id', null, 1, 20, 'Tech');

      expect(mockPrismaService.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            memberships: expect.any(Object),
            OR: expect.any(Array),
          }),
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

      await expect(service.findOne('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if inactive', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        ...mockCompany,
        isActive: false,
      });

      await expect(service.findOne('company-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update company info', async () => {
      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(mockCompany) // first findOne
        .mockResolvedValueOnce({ ...mockCompany, name: 'Updated' }); // second findOne
      mockPrismaService.company.update.mockResolvedValue({});

      await service.update('company-id', { name: 'Updated' });

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
        globalDepartment: {
          id: 'dept-1',
          name: 'Umumiy chat',
          slug: 'general-chat',
        },
      });

      const result = await service.enableDepartment('company-id', 'dept-1');

      expect(result.isEnabled).toBe(true);
    });

    it('should create config if not exists', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.companyDepartmentConfig.create.mockResolvedValue({
        id: 'new-config',
        isEnabled: true,
        globalDepartment: { id: 'dept-new', name: 'New', slug: 'new' },
      });

      await service.enableDepartment('company-id', 'dept-new');

      expect(
        mockPrismaService.companyDepartmentConfig.create,
      ).toHaveBeenCalled();
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
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(
        null,
      );

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
      mockPrismaService.company.findMany.mockResolvedValue([
        mockDeletedCompany,
      ]);
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
        .mockResolvedValueOnce(mockDeletedCompany) // first check
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

      await expect(service.restore('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if company is already active', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany); // isActive: true

      await expect(service.restore('company-id')).rejects.toThrow(
        ConflictException,
      );
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
      mockPrismaService.company.findUnique.mockResolvedValue(
        mockDeletedCompany,
      );
      mockPrismaService.company.delete.mockResolvedValue({});

      const result = await service.permanentDelete('company-id');

      expect(mockPrismaService.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-id' },
      });
      expect(result.message).toBe("Kompaniya butunlay o'chirildi");
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.permanentDelete('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if company is still active', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany); // isActive: true

      await expect(service.permanentDelete('company-id')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
