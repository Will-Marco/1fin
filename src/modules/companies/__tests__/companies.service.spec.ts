import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../companies.service';
import { PrismaService } from '../../../database/prisma.service';
import { DEFAULT_DEPARTMENTS } from '../../../common/constants';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-id',
    name: 'Tech Solutions',
    inn: '123456789',
    logo: null,
    address: 'Tashkent',
    requisites: null,
    isActive: true,
    createdById: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    departments: DEFAULT_DEPARTMENTS.map((d, i) => ({
      id: `dept-${i}`,
      name: d.name,
      slug: d.slug,
      isDefault: true,
    })),
    _count: { userCompanies: 0, operatorCompanies: 0 },
  };

  const mockTx = {
    company: {
      create: jest.fn(),
    },
    department: {
      createMany: jest.fn(),
    },
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    department: {
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

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a company with default departments', async () => {
      const dto = { name: 'Tech Solutions', inn: '123456789', address: 'Tashkent' };

      mockPrismaService.company.findUnique.mockResolvedValueOnce(null);

      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        mockTx.company.create.mockResolvedValue({ id: 'company-id' });
        mockTx.department.createMany.mockResolvedValue({ count: 9 });
        await cb(mockTx);
        return mockCompany;
      });

      mockPrismaService.company.findUnique.mockResolvedValueOnce(mockCompany);

      const result = await service.create(dto, 'admin-id');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if INN already exists', async () => {
      const dto = { name: 'Tech Solutions', inn: '123456789' };

      mockPrismaService.company.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto, 'admin-id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow creating company without INN', async () => {
      const dto = { name: 'No INN Company' };

      mockPrismaService.$transaction.mockImplementation(async (cb) => {
        mockTx.company.create.mockResolvedValue({ id: 'company-id-2' });
        mockTx.department.createMany.mockResolvedValue({ count: 9 });
        await cb(mockTx);
        return { ...mockCompany, id: 'company-id-2', inn: null };
      });

      mockPrismaService.company.findUnique.mockResolvedValue({
        ...mockCompany,
        id: 'company-id-2',
        inn: null,
      });

      const result = await service.create(dto, 'admin-id');

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated companies', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([mockCompany]);
      mockPrismaService.company.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should use default pagination values', async () => {
      mockPrismaService.company.findMany.mockResolvedValue([]);
      mockPrismaService.company.count.mockResolvedValue(0);

      const result = await service.findAll();

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  describe('findOne', () => {
    it('should return a company by ID', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.findOne('company-id');

      expect(result).toEqual(mockCompany);
      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if company is inactive', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue({
        ...mockCompany,
        isActive: false,
      });

      await expect(service.findOne('company-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a company', async () => {
      const dto = { name: 'Updated Name' };

      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue({
        ...mockCompany,
        name: 'Updated Name',
      });

      const result = await service.update('company-id', dto);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: dto,
      });
    });

    it('should throw ConflictException if updating to existing INN', async () => {
      const dto = { inn: '999999999' };

      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(mockCompany)
        .mockResolvedValueOnce({ id: 'other-company', inn: '999999999' });

      await expect(service.update('company-id', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow updating to same INN (own company)', async () => {
      const dto = { inn: '123456789' };

      mockPrismaService.company.findUnique
        .mockResolvedValueOnce(mockCompany)
        .mockResolvedValueOnce({ id: 'company-id', inn: '123456789' })
        .mockResolvedValueOnce(mockCompany);
      mockPrismaService.company.update.mockResolvedValue(mockCompany);

      await service.update('company-id', dto);

      expect(mockPrismaService.company.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a company', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue({
        ...mockCompany,
        isActive: false,
      });

      const result = await service.remove('company-id');

      expect(result.message).toBe('Company deleted successfully');
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLogo', () => {
    it('should update company logo', async () => {
      const logoPath = '/uploads/logos/test.jpg';

      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue({
        ...mockCompany,
        logo: logoPath,
      });

      const result = await service.updateLogo('company-id', logoPath);

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-id' },
        data: { logo: logoPath },
      });
    });
  });
});
