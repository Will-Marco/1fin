import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../database/prisma.service';
import { Role } from '../../../../generated/prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        'jwt.accessSecret': 'test-access-secret',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      phone: '+998901234567',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      deviceName: 'iPhone 15',
      deviceType: 'mobile',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        phone: registerDto.phone,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.EMPLOYEE,
      };

      const mockSession = {
        id: 'session-id',
        userId: mockUser.id,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.session.findMany.mockResolvedValue([]);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.register(registerDto);

      expect(result.user.phone).toBe(registerDto.phone);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          phone: registerDto.phone,
          password: 'hashed-password',
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      });
    });

    it('should throw ConflictException if phone already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Phone number already exists',
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      phone: '+998901234567',
      password: 'password123',
      deviceName: 'iPhone 15',
      deviceType: 'mobile',
    };

    const mockUser = {
      id: 'user-id',
      phone: loginDto.phone,
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.EMPLOYEE,
      isActive: true,
    };

    it('should login successfully with valid credentials', async () => {
      const mockSession = {
        id: 'session-id',
        userId: mockUser.id,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.session.findMany.mockResolvedValue([]);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(loginDto);

      expect(result.user.phone).toBe(loginDto.phone);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'User account is deactivated',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockPrismaService.session.delete.mockResolvedValue({});

      const result = await service.logout('session-id');

      expect(result.message).toBe('Logged out successfully');
      expect(mockPrismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-id' },
      });
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.logoutAll('user-id');

      expect(result.message).toBe('Logged out from all devices');
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          deviceName: 'iPhone 15',
          deviceType: 'mobile',
          ipAddress: '127.0.0.1',
          lastActiveAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockPrismaService.session.findMany.mockResolvedValue(mockSessions);

      const result = await service.getSessions('user-id');

      expect(result).toEqual(mockSessions);
      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          ipAddress: true,
          lastActiveAt: true,
          createdAt: true,
        },
        orderBy: { lastActiveAt: 'desc' },
      });
    });
  });

  describe('session limit (max 3 devices)', () => {
    it('should remove oldest session when limit exceeded', async () => {
      const registerDto = {
        phone: '+998901234568',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        deviceName: 'New Device',
        deviceType: 'mobile',
      };

      const mockUser = {
        id: 'user-id',
        phone: registerDto.phone,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.EMPLOYEE,
      };

      const existingSessions = [
        { id: 'session-1', createdAt: new Date('2024-01-01') },
        { id: 'session-2', createdAt: new Date('2024-01-02') },
        { id: 'session-3', createdAt: new Date('2024-01-03') },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.session.findMany.mockResolvedValue(existingSessions);
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.session.create.mockResolvedValue({
        id: 'new-session',
        userId: mockUser.id,
      });
      mockPrismaService.session.update.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockJwtService.signAsync.mockResolvedValue('token');

      await service.register(registerDto);

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['session-1'] },
        },
      });
    });
  });
});
