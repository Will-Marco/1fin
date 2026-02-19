import { Test, TestingModule } from '@nestjs/testing';
import { SystemRole } from '../../../../generated/prisma/client';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login user', async () => {
      const loginDto = {
        username: 'admin01',
        password: 'password123',
        deviceName: 'iPhone 15',
        deviceType: 'mobile',
      };

      const expectedResult = {
        user: {
          id: 'user-id',
          username: loginDto.username,
          name: 'Admin User',
          systemRole: SystemRole.FIN_ADMIN,
          mustChangePassword: false,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const mockRequest = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'Test Agent' },
      } as any;

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        '127.0.0.1',
        'Test Agent',
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const refreshDto = { refreshToken: 'old-refresh-token' };
      const mockUser = { sub: 'user-id', sessionId: 'session-id' };

      const expectedResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshTokens.mockResolvedValue(expectedResult);

      const result = await controller.refresh(refreshDto, mockUser);

      expect(result).toEqual(expectedResult);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'user-id',
        'session-id',
        'old-refresh-token',
      );
    });
  });

  describe('logout', () => {
    it('should logout from current device', async () => {
      const expectedResult = { message: 'Logged out successfully' };
      mockAuthService.logout.mockResolvedValue(expectedResult);

      const result = await controller.logout('session-id');

      expect(result).toEqual(expectedResult);
      expect(authService.logout).toHaveBeenCalledWith('session-id');
    });
  });

  describe('logoutAll', () => {
    it('should logout from all devices', async () => {
      const expectedResult = { message: 'Logged out from all devices' };
      mockAuthService.logoutAll.mockResolvedValue(expectedResult);

      const result = await controller.logoutAll('user-id');

      expect(result).toEqual(expectedResult);
      expect(authService.logoutAll).toHaveBeenCalledWith('user-id');
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const expectedSessions = [
        {
          id: 'session-1',
          deviceName: 'iPhone 15',
          deviceType: 'mobile',
          ipAddress: '127.0.0.1',
          lastActiveAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockAuthService.getSessions.mockResolvedValue(expectedSessions);

      const result = await controller.getSessions('user-id');

      expect(result).toEqual(expectedSessions);
      expect(authService.getSessions).toHaveBeenCalledWith('user-id');
    });
  });

  describe('terminateSession', () => {
    it('should terminate a specific session', async () => {
      const expectedResult = { message: 'Logged out successfully' };
      mockAuthService.logout.mockResolvedValue(expectedResult);

      const result = await controller.terminateSession('session-id');

      expect(result).toEqual(expectedResult);
      expect(authService.logout).toHaveBeenCalledWith('session-id');
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 'user-id',
        username: 'admin01',
        name: 'Admin User',
        systemRole: SystemRole.FIN_ADMIN,
        sessionId: 'session-id',
      };

      const result = await controller.getProfile(mockUser);

      expect(result).toEqual(mockUser);
    });
  });
});
