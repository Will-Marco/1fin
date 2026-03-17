import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemRole } from '../../../../generated/prisma/client';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 'user-id',
    username: 'fin_employee01',
    name: 'Ali Valiyev',
    systemRole: SystemRole.FIN_EMPLOYEE,
    isActive: true,
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

  const mockUsersService = {
    createSystemUser: jest.fn(),
    createClientUser: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    assignMembership: jest.fn(),
    updateMembership: jest.fn(),
    removeMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        Reflector,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('createSystemUser', () => {
    const dto = {
      username: 'fin_employee01',
      name: 'Ali',
      systemRole: SystemRole.FIN_EMPLOYEE,
    };

    it('should create a system user with passport', async () => {
      mockUsersService.createSystemUser.mockResolvedValue(mockUser);

      const result = await controller.createSystemUser(dto, {
        passport: [mockPassportFile],
        documents: [],
      });

      expect(result).toEqual(mockUser);
      expect(service.createSystemUser).toHaveBeenCalledWith(
        dto,
        mockPassportFile,
        [],
      );
    });

    it('should create a system user with passport and documents', async () => {
      mockUsersService.createSystemUser.mockResolvedValue(mockUser);

      const result = await controller.createSystemUser(dto, {
        passport: [mockPassportFile],
        documents: [mockDocumentFile],
      });

      expect(result).toEqual(mockUser);
      expect(service.createSystemUser).toHaveBeenCalledWith(
        dto,
        mockPassportFile,
        [mockDocumentFile],
      );
    });

    it('should throw BadRequestException if passport is missing', async () => {
      await expect(
        controller.createSystemUser(dto, { passport: [], documents: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no files provided', async () => {
      await expect(
        controller.createSystemUser(dto, {} as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createClientUser', () => {
    const dto = {
      username: 'client01',
      name: 'Bobur',
      systemRole: SystemRole.CLIENT_DIRECTOR,
    };

    it('should create a client user with passport', async () => {
      const clientUser = {
        ...mockUser,
        systemRole: SystemRole.CLIENT_DIRECTOR,
        userDocuments: [],
      };
      mockUsersService.createClientUser.mockResolvedValue(clientUser);

      const result = await controller.createClientUser(dto, {
        passport: [mockPassportFile],
      });

      expect(result.systemRole).toBe(SystemRole.CLIENT_DIRECTOR);
      expect(service.createClientUser).toHaveBeenCalledWith(
        dto,
        mockPassportFile,
        undefined,
      );
    });

    it('should throw BadRequestException if passport is missing', async () => {
      await expect(
        controller.createClientUser(dto, { passport: [], documents: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users with role visibility', async () => {
      const paginated = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockUsersService.findAll.mockResolvedValue(paginated);

      const result = await controller.findAll(
        '1',
        '20',
        undefined,
        undefined,
        undefined,
        SystemRole.FIN_DIRECTOR,
      );

      expect(result).toEqual(paginated);
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        20,
        {
          search: undefined,
          companyId: undefined,
          systemRole: undefined,
        },
        SystemRole.FIN_DIRECTOR,
      );
    });

    it('should parse systemRole filter from comma-separated string', async () => {
      const paginated = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockUsersService.findAll.mockResolvedValue(paginated);

      await controller.findAll(
        '1',
        '20',
        undefined,
        undefined,
        'FIN_EMPLOYEE,CLIENT_DIRECTOR',
        SystemRole.FIN_ADMIN,
      );

      expect(service.findAll).toHaveBeenCalledWith(
        1,
        20,
        {
          search: undefined,
          companyId: undefined,
          systemRole: ['FIN_EMPLOYEE', 'CLIENT_DIRECTOR'],
        },
        SystemRole.FIN_ADMIN,
      );
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-id');

      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update user info', async () => {
      const dto = { name: 'Updated Name' };
      mockUsersService.update.mockResolvedValue({ ...mockUser, name: 'Updated Name' });

      const result = await controller.update('user-id', dto);

      expect(result.name).toBe('Updated Name');
      expect(service.update).toHaveBeenCalledWith('user-id', dto);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user', async () => {
      mockUsersService.deactivate.mockResolvedValue({
        message: "Foydalanuvchi o'chirildi",
      });

      const result = await controller.deactivate('user-id');

      expect(result.message).toBeDefined();
      expect(service.deactivate).toHaveBeenCalledWith('user-id');
    });
  });

  describe('assignMembership', () => {
    it('should assign user to company', async () => {
      const dto = {
        companyId: 'company-id',
        rank: 1,
        allowedDepartmentIds: ['dept-id-1'],
      };
      const membership = {
        id: 'membership-id',
        rank: 1,
        isActive: true,
        company: { id: 'company-id', name: 'Test Company' },
        allowedDepartments: [],
      };
      mockUsersService.assignMembership.mockResolvedValue(membership);

      const result = await controller.assignMembership('user-id', dto);

      expect(result.rank).toBe(1);
      expect(service.assignMembership).toHaveBeenCalledWith('user-id', dto);
    });
  });

  describe('updateMembership', () => {
    it('should update a membership', async () => {
      const dto = { rank: 2 };
      mockUsersService.updateMembership.mockResolvedValue(mockUser);

      await controller.updateMembership('user-id', 'membership-id', dto);

      expect(service.updateMembership).toHaveBeenCalledWith(
        'user-id',
        'membership-id',
        dto,
      );
    });
  });

  describe('removeMembership', () => {
    it('should remove a membership', async () => {
      mockUsersService.removeMembership.mockResolvedValue({
        message: "Membership o'chirildi",
      });

      const result = await controller.removeMembership('user-id', 'membership-id');

      expect(result.message).toBeDefined();
      expect(service.removeMembership).toHaveBeenCalledWith('user-id', 'membership-id');
    });
  });
});
