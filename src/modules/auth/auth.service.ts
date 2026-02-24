import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto, ChangePasswordDto, UpdateProfileDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MAX_SESSIONS_PER_USER } from '../../common/constants';
import { SystemRole } from '../../../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { sessionId, ...tokens } = await this.createSession(
      user.id,
      user.systemRole,
      dto.deviceName,
      dto.deviceType,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        systemRole: user.systemRole,
        notificationsEnabled: user.notificationsEnabled,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        sessionId,
      },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, sessionId: string, refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Invalid session');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      session.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(
      session.user.id,
      session.user.systemRole,
      sessionId,
    );

    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: hashedRefreshToken,
        lastActiveAt: new Date(),
      },
    });

    return tokens;
  }

  async logout(sessionId: string) {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out from all devices' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        mustChangePassword: false,
      },
    });

    return { message: 'Password changed successfully' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        avatar: true,
        systemRole: true,
      },
    });

    return updated;
  }

  async updateAvatar(userId: string, avatarPath: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarPath },
    });

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        avatar: true,
        systemRole: true,
      },
    });
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
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
  }

  private async createSession(
    userId: string,
    systemRole: SystemRole | null,
    deviceName: string,
    deviceType: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (sessions.length >= MAX_SESSIONS_PER_USER) {
      const sessionsToDelete = sessions.slice(
        0,
        sessions.length - MAX_SESSIONS_PER_USER + 1,
      );

      await this.prisma.session.deleteMany({
        where: {
          id: { in: sessionsToDelete.map((s) => s.id) },
        },
      });
    }

    const session = await this.prisma.session.create({
      data: {
        userId,
        deviceName,
        deviceType,
        refreshToken: 'temp',
        ipAddress,
        userAgent,
      },
    });

    const tokens = await this.generateTokens(userId, systemRole, session.id);

    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return {
      sessionId: session.id,
      ...tokens,
    };
  }

  private async generateTokens(
    userId: string,
    systemRole: SystemRole | null,
    sessionId: string,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      sessionId,
    };

    // Only include systemRole if user is 1FIN employee
    if (systemRole) {
      payload.systemRole = systemRole;
    }

    const accessExpiresIn = this.parseExpiration(
      this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    );
    const refreshExpiresIn = this.parseExpiration(
      this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private parseExpiration(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900;
    }

    const num = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return num;
      case 'm':
        return num * 60;
      case 'h':
        return num * 60 * 60;
      case 'd':
        return num * 60 * 60 * 24;
      default:
        return 900;
    }
  }
}
