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
});
