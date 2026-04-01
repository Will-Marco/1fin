import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SystemRole } from '../../../generated/prisma/client';
import { CreateGlobalDepartmentDto, UpdateGlobalDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // ─────────────────────────────────────────────
  // GLOBAL DEPARTMENT CRUD (1FIN admin only)
  // ─────────────────────────────────────────────

  async create(dto: CreateGlobalDepartmentDto) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    const existing = await this.prisma.globalDepartment.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Bu slug bilan department allaqachon mavjud');
    }

    return this.prisma.globalDepartment.create({
      data: {
        name: dto.name,
        slug,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(includeInactive = false) {
    return this.prisma.globalDepartment.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { companyConfigs: { where: { isEnabled: true } } },
        },
      },
    });
  }

  async findOne(id: string) {
    const dept = await this.prisma.globalDepartment.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { companyConfigs: { where: { isEnabled: true } } },
        },
      },
    });

    if (!dept) {
      throw new NotFoundException('Global department topilmadi');
    }

    return dept;
  }

  async update(id: string, dto: UpdateGlobalDepartmentDto) {
    await this.findOne(id);

    const updateData: any = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.slug) {
      const existing = await this.prisma.globalDepartment.findUnique({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Bu slug bilan department allaqachon mavjud',
        );
      }
      updateData.slug = dto.slug;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    return this.prisma.globalDepartment.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft-deactivate: sets isActive=false.
   * Note: This does NOT remove CompanyDepartmentConfigs.
   * Those configs become effectively hidden until re-activated.
   */
  async deactivate(id: string) {
    await this.findOne(id);

    await this.prisma.globalDepartment.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "Global department o'chirildi" };
  }

  // ─────────────────────────────────────────────
  // UNREAD MESSAGES TRACKING
  // ─────────────────────────────────────────────

  /**
   * Internal helper: returns departments visible to a user inside one company.
   * FIN_* → all enabled company departments.
   * CLIENT_* → only their allowed departments.
   */
  private async getDepartmentsForUser(
    userId: string,
    companyId: string,
    isFINUser: boolean,
  ): Promise<{ id: string; name: string; slug: string }[]> {
    if (isFINUser) {
      const configs = await this.prisma.companyDepartmentConfig.findMany({
        where: { companyId, isEnabled: true },
        select: {
          globalDepartment: { select: { id: true, name: true, slug: true } },
        },
      });
      return configs.map((c) => c.globalDepartment);
    }

    const membership = await this.prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: {
        allowedDepartments: {
          select: {
            globalDepartment: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return (
      membership?.allowedDepartments.map((ad) => ad.globalDepartment) ?? []
    );
  }

  /**
   * Internal helper: unread counts for a list of departments in one company.
   */
  private async countUnreadForDepartments(
    userId: string,
    companyId: string,
    departments: { id: string; name: string; slug: string }[],
  ) {
    if (departments.length === 0) return [];

    const userReads = await this.prisma.userDepartmentRead.findMany({
      where: { userId, companyId },
      select: { globalDepartmentId: true, lastReadAt: true },
    });
    const readMap = new Map(
      userReads.map((r) => [r.globalDepartmentId, r.lastReadAt]),
    );

    return Promise.all(
      departments.map(async (dept) => {
        const lastReadAt = readMap.get(dept.id);
        const unreadCount = await this.prisma.message.count({
          where: {
            globalDepartmentId: dept.id,
            companyId,
            isDeleted: false,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          departmentSlug: dept.slug,
          unreadCount,
        };
      }),
    );
  }

  /**
   * Get unread message summary for all departments in a single company.
   * FIN_* users see all departments, CLIENT_* users see only their allowed departments.
   */
  async getUnreadSummary(
    userId: string,
    companyId: string,
    userSystemRole: SystemRole,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId majburiy');
    }

    const isFINUser = (
      [
        SystemRole.FIN_DIRECTOR,
        SystemRole.FIN_ADMIN,
        SystemRole.FIN_EMPLOYEE,
      ] as SystemRole[]
    ).includes(userSystemRole);

    const departments = await this.getDepartmentsForUser(
      userId,
      companyId,
      isFINUser,
    );
    if (!isFINUser && departments.length === 0) {
      return { departments: [], totalUnread: 0 };
    }

    const departmentResults = await this.countUnreadForDepartments(
      userId,
      companyId,
      departments,
    );
    const totalUnread = departmentResults.reduce(
      (sum, d) => sum + d.unreadCount,
      0,
    );

    return { departments: departmentResults, totalUnread };
  }

  /**
   * Get unread message summary across ALL companies the user belongs to.
   * Returns per-company breakdown with per-department counts and grand total.
   * Designed to be called once to power a global unread badge on the frontend.
   */
  async getAllCompaniesUnreadSummary(
    userId: string,
    userSystemRole: SystemRole,
  ) {
    const isFINUser = (
      [
        SystemRole.FIN_DIRECTOR,
        SystemRole.FIN_ADMIN,
        SystemRole.FIN_EMPLOYEE,
      ] as SystemRole[]
    ).includes(userSystemRole);

    // 1. Fetch all active company memberships for this user
    const memberships = await this.prisma.userCompanyMembership.findMany({
      where: { userId, isActive: true },
      select: {
        company: { select: { id: true, name: true } },
      },
    });

    // 2. For each company — resolve departments + count unreads in parallel
    const companyResults = await Promise.all(
      memberships.map(async ({ company }) => {
        const departments = await this.getDepartmentsForUser(
          userId,
          company.id,
          isFINUser,
        );
        const departmentResults = await this.countUnreadForDepartments(
          userId,
          company.id,
          departments,
        );
        const totalUnread = departmentResults.reduce(
          (sum, d) => sum + d.unreadCount,
          0,
        );

        return {
          companyId: company.id,
          companyName: company.name,
          totalUnread,
          departments: departmentResults,
        };
      }),
    );

    const grandTotalUnread = companyResults.reduce(
      (sum, c) => sum + c.totalUnread,
      0,
    );

    return { companies: companyResults, grandTotalUnread };
  }

  /**
   * Mark a specific department as read for the current user.
   */
  async markDepartmentAsRead(
    userId: string,
    companyId: string,
    departmentId: string,
  ) {
    if (!companyId || !departmentId) {
      throw new BadRequestException('companyId va departmentId majburiy');
    }

    // Verify department exists
    const dept = await this.prisma.globalDepartment.findUnique({
      where: { id: departmentId },
    });

    if (!dept) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    // Upsert the read record
    await this.prisma.userDepartmentRead.upsert({
      where: {
        userId_companyId_globalDepartmentId: {
          userId,
          companyId,
          globalDepartmentId: departmentId,
        },
      },
      update: {
        lastReadAt: new Date(),
      },
      create: {
        userId,
        companyId,
        globalDepartmentId: departmentId,
        lastReadAt: new Date(),
      },
    });

    return { message: "Bo'lim o'qilgan deb belgilandi" };
  }

  /**
   * Mark all departments as read for the current user in a company.
   */
  async markAllAsRead(
    userId: string,
    companyId: string,
    userSystemRole: SystemRole,
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId majburiy');
    }

    const isFINUser = (
      [
        SystemRole.FIN_DIRECTOR,
        SystemRole.FIN_ADMIN,
        SystemRole.FIN_EMPLOYEE,
      ] as SystemRole[]
    ).includes(userSystemRole);

    const departments = await this.getDepartmentsForUser(
      userId,
      companyId,
      isFINUser,
    );
    const departmentIds = departments.map((d) => d.id);

    if (departmentIds.length === 0) {
      return { message: "Barcha bo'limlar o'qilgan deb belgilandi", count: 0 };
    }

    const now = new Date();

    // Upsert all department read records
    await Promise.all(
      departmentIds.map((deptId) =>
        this.prisma.userDepartmentRead.upsert({
          where: {
            userId_companyId_globalDepartmentId: {
              userId,
              companyId,
              globalDepartmentId: deptId,
            },
          },
          update: { lastReadAt: now },
          create: {
            userId,
            companyId,
            globalDepartmentId: deptId,
            lastReadAt: now,
          },
        }),
      ),
    );

    return {
      message: "Barcha bo'limlar o'qilgan deb belgilandi",
      count: departmentIds.length,
    };
  }
}
