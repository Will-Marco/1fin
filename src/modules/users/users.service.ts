import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { SystemRole } from '../../../generated/prisma/client';
import {
    AssignMembershipDto,
    CreateClientUserDto,
    CreateSystemUserDto,
    UpdateMembershipDto,
    UpdateUserDto,
} from './dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────
  // USER CRUD
  // ─────────────────────────────────────────────

  /**
   * Create a 1FIN system user (FIN_DIRECTOR / FIN_ADMIN / FIN_EMPLOYEE).
   * Called by FIN_DIRECTOR or FIN_ADMIN.
   */
  async createSystemUser(dto: CreateSystemUserDto) {
    await this.ensureUsernameAvailable(dto.username);

    const defaultPassword =
      this.configService.get<string>('DEFAULT_USER_PASSWORD') || '1Fin@2024';
    const passwordToUse = dto.password || defaultPassword;
    const hashedPassword = await bcrypt.hash(passwordToUse, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
        avatar: dto.avatar,
        systemRole: dto.systemRole,
        mustChangePassword: !dto.password, // if default password, must change
      },
    });

    return this.findOne(user.id);
  }

  /**
   * Create a client user (CLIENT_FOUNDER / CLIENT_DIRECTOR / CLIENT_EMPLOYEE).
   * systemRole is now required and set at user creation.
   */
  async createClientUser(dto: CreateClientUserDto) {
    await this.ensureUsernameAvailable(dto.username);

    const defaultPassword =
      this.configService.get<string>('DEFAULT_USER_PASSWORD') || '1Fin@2024';
    const passwordToUse = dto.password || defaultPassword;
    const hashedPassword = await bcrypt.hash(passwordToUse, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
        avatar: dto.avatar,
        systemRole: dto.systemRole,
        mustChangePassword: !dto.password, // if default password, must change
      },
    });

    return this.findOne(user.id);
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: {
      search?: string;
      companyId?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };

    if (filters?.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters?.companyId) {
      where.memberships = {
        some: { companyId: filters.companyId, isActive: true },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          avatar: true,
          systemRole: true,
          notificationsEnabled: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        avatar: true,
        systemRole: true,
        notificationsEnabled: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          where: { isActive: true },
          select: {
            id: true,
            rank: true,
            isActive: true,
            createdAt: true,
            company: {
              select: { id: true, name: true, inn: true, logo: true },
            },
            allowedDepartments: {
              select: {
                globalDepartment: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    return this.findOne(id);
  }

  /**
   * Soft-delete user (set isActive = false).
   * Also deactivates all company memberships.
   */
  async deactivate(id: string) {
    await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.userCompanyMembership.updateMany({
        where: { userId: id },
        data: { isActive: false },
      }),
    ]);

    return { message: 'Foydalanuvchi o\'chirildi' };
  }

  // ─────────────────────────────────────────────
  // MEMBERSHIP MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Assign a user to a company with optional rank and department access.
   * Rank (1-3) only for CLIENT_EMPLOYEE and FIN_EMPLOYEE.
   * One user can only have ONE membership per company.
   */
  async assignMembership(userId: string, dto: AssignMembershipDto) {
    const user = await this.findOne(userId);

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company || !company.isActive) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    // Validate rank: only for EMPLOYEE roles
    if (dto.rank !== undefined) {
      if (
        user.systemRole !== SystemRole.CLIENT_EMPLOYEE &&
        user.systemRole !== SystemRole.FIN_EMPLOYEE
      ) {
        throw new BadRequestException(
          'Rank faqat CLIENT_EMPLOYEE va FIN_EMPLOYEE uchun berilishi mumkin',
        );
      }
    }

    // Check if any of the department IDs are valid
    if (dto.allowedDepartmentIds.length > 0) {
      await this.validateDepartmentIds(dto.allowedDepartmentIds, dto.companyId);
    }

    const existing = await this.prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId, companyId: dto.companyId } },
    });
    if (existing) {
      throw new ConflictException(
        'Foydalanuvchi bu kompaniyada allaqachon ro\'yxatdan o\'tgan',
      );
    }

    const membership = await this.prisma.userCompanyMembership.create({
      data: {
        userId,
        companyId: dto.companyId,
        rank: dto.rank,
        allowedDepartments: {
          create: dto.allowedDepartmentIds.map((deptId) => ({
            globalDepartmentId: deptId,
          })),
        },
      },
      select: {
        id: true,
        rank: true,
        isActive: true,
        company: { select: { id: true, name: true } },
        allowedDepartments: {
          select: {
            globalDepartment: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return membership;
  }

  /**
   * Update an existing membership's rank and/or department access.
   * allowedDepartmentIds fully replaces existing department access.
   */
  async updateMembership(
    userId: string,
    membershipId: string,
    dto: UpdateMembershipDto,
  ) {
    const membership = await this.prisma.userCompanyMembership.findFirst({
      where: { id: membershipId, userId },
      include: { user: { select: { systemRole: true } } },
    });

    if (!membership) {
      throw new NotFoundException('Membership topilmadi');
    }

    // Validate rank: only for EMPLOYEE roles
    if (dto.rank !== undefined) {
      if (
        membership.user.systemRole !== SystemRole.CLIENT_EMPLOYEE &&
        membership.user.systemRole !== SystemRole.FIN_EMPLOYEE
      ) {
        throw new BadRequestException(
          'Rank faqat CLIENT_EMPLOYEE va FIN_EMPLOYEE uchun berilishi mumkin',
        );
      }
    }

    if (
      dto.allowedDepartmentIds !== undefined &&
      dto.allowedDepartmentIds.length > 0
    ) {
      await this.validateDepartmentIds(
        dto.allowedDepartmentIds,
        membership.companyId,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.rank !== undefined) {
        await tx.userCompanyMembership.update({
          where: { id: membershipId },
          data: { rank: dto.rank },
        });
      }

      if (dto.allowedDepartmentIds !== undefined) {
        // Replace department access
        await tx.membershipDepartmentAccess.deleteMany({
          where: { userCompanyMembershipId: membershipId },
        });
        if (dto.allowedDepartmentIds.length > 0) {
          await tx.membershipDepartmentAccess.createMany({
            data: dto.allowedDepartmentIds.map((deptId) => ({
              userCompanyMembershipId: membershipId,
              globalDepartmentId: deptId,
            })),
          });
        }
      }
    });

    return this.findOne(userId);
  }

  /**
   * Remove a user from a company (hard delete membership).
   */
  async removeMembership(userId: string, membershipId: string) {
    const membership = await this.prisma.userCompanyMembership.findFirst({
      where: { id: membershipId, userId },
    });

    if (!membership) {
      throw new NotFoundException('Membership topilmadi');
    }

    await this.prisma.userCompanyMembership.delete({
      where: { id: membershipId },
    });

    return { message: 'Membership o\'chirildi' };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async ensureUsernameAvailable(username: string) {
    const existing = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      throw new ConflictException('Bu username allaqachon band');
    }
  }

  /**
   * Validates that all given department IDs exist as GlobalDepartments
   * AND are enabled for the given company (CompanyDepartmentConfig).
   */
  private async validateDepartmentIds(deptIds: string[], companyId: string) {
    const configs = await this.prisma.companyDepartmentConfig.findMany({
      where: {
        companyId,
        globalDepartmentId: { in: deptIds },
        isEnabled: true,
      },
      select: { globalDepartmentId: true },
    });

    const validIds = new Set(configs.map((c) => c.globalDepartmentId));

    const invalidIds = deptIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Quyidagi department IDlar bu kompaniya uchun mavjud emas yoki o'chirilgan: ${invalidIds.join(', ')}`,
      );
    }
  }
}
