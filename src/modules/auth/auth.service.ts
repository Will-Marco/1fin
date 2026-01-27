import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MAX_SESSIONS_PER_USER } from '../../common/constants';
import { Role } from '../../../generated/prisma/client';

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

    const tokens = await this.createSession(
      user.id,
      user.role,
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
        role: user.role,
        mustChangePassword: user.mustChangePassword,
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
      session.user.role,
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
    role: Role,
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

    const tokens = await this.generateTokens(userId, role, session.id);

    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return tokens;
  }

  private async generateTokens(userId: string, role: Role, sessionId: string) {
    const payload: JwtPayload = {
      sub: userId,
      role,
      sessionId,
    };

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
