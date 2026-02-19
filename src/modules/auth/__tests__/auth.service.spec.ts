import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
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

    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto = {
      username: 'admin01',
      password: 'password123',
      deviceName: 'iPhone 15',
      deviceType: 'mobile',
    };

    const mockUser = {
      id: 'user-id',
      username: loginDto.username,
      password: 'hashed-password',
      name: 'Admin User',
      systemRole: SystemRole.FIN_ADMIN,
      isActive: true,
      mustChangePassword: false,
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

      expect(result.user.username).toBe(loginDto.username);
      expect(result.user.name).toBe('Admin User');
      expect(result.user.systemRole).toBe(SystemRole.FIN_ADMIN);
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should return mustChangePassword flag', async () => {
      const userWithTempPassword = { ...mockUser, mustChangePassword: true };
      const mockSession = { id: 'session-id', userId: mockUser.id };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithTempPassword);
      mockPrismaService.session.findMany.mockResolvedValue([]);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockJwtService.signAsync.mockResolvedValue('token');

      const result = await service.login(loginDto);

      expect(result.user.mustChangePassword).toBe(true);
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

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        refreshToken: 'hashed-refresh',
        user: { id: 'user-id', systemRole: SystemRole.FIN_ADMIN },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh');
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockPrismaService.session.update.mockResolvedValue({});

      const result = await service.refreshTokens('user-id', 'session-id', 'old-refresh');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for invalid session', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-id', 'invalid-session', 'refresh'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const mockSession = {
        id: 'session-id',
        userId: 'user-id',
        refreshToken: 'hashed-refresh',
        user: { id: 'user-id', systemRole: SystemRole.FIN_ADMIN },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens('user-id', 'session-id', 'wrong-refresh'),
      ).rejects.toThrow(UnauthorizedException);
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
      const loginDto = {
        username: 'testuser',
        password: 'password123',
        deviceName: 'New Device',
        deviceType: 'mobile',
      };

      const mockUser = {
        id: 'user-id',
        username: loginDto.username,
        password: 'hashed-password',
        name: 'Test User',
        systemRole: SystemRole.FIN_EMPLOYEE,
        isActive: true,
        mustChangePassword: false,
      };

      const existingSessions = [
        { id: 'session-1', createdAt: new Date('2024-01-01') },
        { id: 'session-2', createdAt: new Date('2024-01-02') },
        { id: 'session-3', createdAt: new Date('2024-01-03') },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.session.findMany.mockResolvedValue(existingSessions);
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.session.create.mockResolvedValue({
        id: 'new-session',
        userId: mockUser.id,
      });
      mockPrismaService.session.update.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockJwtService.signAsync.mockResolvedValue('token');

      await service.login(loginDto);

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['session-1'] },
        },
      });
    });
  });
});
