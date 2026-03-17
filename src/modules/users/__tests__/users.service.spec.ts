import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { SystemRole, UserDocumentType } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER } from '../../files/storage/storage.interface';
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
    userDocuments: [],
  };

  const mockClientUser = {
    ...mockUser,
    id: 'client-user-id',
    username: 'client_director01',
    systemRole: SystemRole.CLIENT_DIRECTOR,
    memberships: [],
    userDocuments: [],
  };

  const mockPassportFile = {
    fieldname: 'passport',
    originalname: 'passport.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-passport'),
    size: 1024,
  } as Express.Multer.File;

  const mockDocumentFile = {
    fieldname: 'documents',
    originalname: 'diploma.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake-diploma'),
    size: 2048,
  } as Express.Multer.File;

  const mockUploadResult = {
    originalName: 'passport.pdf',
    fileName: 'uuid-passport.pdf',
    path: 'user-documents/uuid-passport.pdf',
    size: 1024,
    mimeType: 'application/pdf',
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
    userDocument: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'DEFAULT_USER_PASSWORD') return '1Fin@2024';
      return undefined;
    }),
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn((path: string) => `http://localhost:3000/uploads/${path}`),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
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

    it('should create a system user with passport', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)       // username check
        .mockResolvedValueOnce(mockUser);  // findOne
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.userDocument.create.mockResolvedValue({});
      mockStorageProvider.upload.mockResolvedValue(mockUploadResult);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.createSystemUser(dto, mockPassportFile);

      expect(result.username).toBe('fin_employee01');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'fin_employee01',
          systemRole: SystemRole.FIN_EMPLOYEE,
          mustChangePassword: true,
        }),
      });
      expect(mockStorageProvider.upload).toHaveBeenCalledWith(
        mockPassportFile,
        'user-documents',
      );
      expect(mockPrismaService.userDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-id',
          type: UserDocumentType.PASSPORT,
        }),
      });
    });

    it('should create a system user with passport and additional documents', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.userDocument.create.mockResolvedValue({});
      mockStorageProvider.upload
        .mockResolvedValueOnce(mockUploadResult)  // passport
        .mockResolvedValueOnce({                   // additional document
          ...mockUploadResult,
          originalName: 'diploma.pdf',
          fileName: 'uuid-diploma.pdf',
          path: 'user-documents/uuid-diploma.pdf',
        });
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.createSystemUser(
        dto,
        mockPassportFile,
        [mockDocumentFile],
      );

      expect(result.username).toBe('fin_employee01');
      expect(mockStorageProvider.upload).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.userDocument.create).toHaveBeenCalledTimes(2);

      // First call: passport
      expect(mockPrismaService.userDocument.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          type: UserDocumentType.PASSPORT,
        }),
      });

      // Second call: additional document
      expect(mockPrismaService.userDocument.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          type: UserDocumentType.OTHER,
        }),
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createSystemUser(dto, mockPassportFile),
      ).rejects.toThrow(ConflictException);
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

    it('should create a client user with passport', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockClientUser);
      mockPrismaService.user.create.mockResolvedValue(mockClientUser);
      mockPrismaService.userDocument.create.mockResolvedValue({});
      mockStorageProvider.upload.mockResolvedValue(mockUploadResult);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.createClientUser(dto, mockPassportFile);

      expect(result.systemRole).toBe(SystemRole.CLIENT_DIRECTOR);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'client_director01',
          systemRole: SystemRole.CLIENT_DIRECTOR,
          mustChangePassword: true,
        }),
      });
      expect(mockStorageProvider.upload).toHaveBeenCalledWith(
        mockPassportFile,
        'user-documents',
      );
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createClientUser(dto, mockPassportFile),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20, {}, SystemRole.FIN_DIRECTOR);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('should filter by role visibility - FIN_DIRECTOR sees all', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 20, {}, SystemRole.FIN_DIRECTOR);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: { in: Object.values(SystemRole) },
          }),
        }),
      );
    });

    it('should filter by role visibility - FIN_ADMIN cannot see FIN_DIRECTOR', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 20, {}, SystemRole.FIN_ADMIN);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: {
              in: [
                SystemRole.FIN_ADMIN,
                SystemRole.FIN_EMPLOYEE,
                SystemRole.CLIENT_FOUNDER,
                SystemRole.CLIENT_DIRECTOR,
                SystemRole.CLIENT_EMPLOYEE,
              ],
            },
          }),
        }),
      );
    });

    it('should filter by role visibility - FIN_EMPLOYEE cannot see FIN_DIRECTOR and FIN_ADMIN', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(1, 20, {}, SystemRole.FIN_EMPLOYEE);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: {
              in: [
                SystemRole.FIN_EMPLOYEE,
                SystemRole.CLIENT_FOUNDER,
                SystemRole.CLIENT_DIRECTOR,
                SystemRole.CLIENT_EMPLOYEE,
              ],
            },
          }),
        }),
      );
    });

    it('should apply systemRole filter intersected with visibility', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);
      mockPrismaService.user.count.mockResolvedValue(1);

      await service.findAll(
        1,
        20,
        { systemRole: [SystemRole.FIN_EMPLOYEE, SystemRole.CLIENT_DIRECTOR] },
        SystemRole.FIN_ADMIN,
      );

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: {
              in: [SystemRole.FIN_EMPLOYEE, SystemRole.CLIENT_DIRECTOR],
            },
          }),
        }),
      );
    });

    it('should ignore systemRole filter if requesting role cannot see those roles', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      // FIN_EMPLOYEE trying to filter by FIN_DIRECTOR - should be ignored
      await service.findAll(
        1,
        20,
        { systemRole: [SystemRole.FIN_DIRECTOR] },
        SystemRole.FIN_EMPLOYEE,
      );

      // FIN_DIRECTOR is not in FIN_EMPLOYEE's visible roles, so it falls back to visible roles
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            systemRole: {
              in: [
                SystemRole.FIN_EMPLOYEE,
                SystemRole.CLIENT_FOUNDER,
                SystemRole.CLIENT_DIRECTOR,
                SystemRole.CLIENT_EMPLOYEE,
              ],
            },
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // findOne
  // ─────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user with memberships and documents', async () => {
      const userWithDocs = {
        ...mockUser,
        userDocuments: [
          {
            id: 'doc-id',
            type: UserDocumentType.PASSPORT,
            originalName: 'passport.pdf',
            fileName: 'uuid-passport.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            path: 'user-documents/uuid-passport.pdf',
            createdAt: new Date(),
          },
        ],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithDocs);

      const result = await service.findOne('user-id');

      expect(result.username).toBe('fin_employee01');
      expect(result.userDocuments).toHaveLength(1);
      expect(result.userDocuments[0].url).toBe(
        'http://localhost:3000/uploads/user-documents/uuid-passport.pdf',
      );
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
