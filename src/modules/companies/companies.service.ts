import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SystemRole } from '../../../generated/prisma/client';
import { is1FinStaff } from '../../common/constants';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a company, auto-link all active GlobalDepartments,
   * and optionally attach existing users as members — all in one transaction.
   *
   * Returns the company details plus a `skippedUserIds` array for any
   * userId values that couldn't be found in the database.
   */
  async create(dto: CreateCompanyDto, createdById: string) {
    if (dto.inn) {
      const existing = await this.prisma.company.findUnique({
        where: { inn: dto.inn },
      });
      if (existing) {
        throw new ConflictException('Bu INN bilan kompaniya allaqachon mavjud');
      }
    }

    // ── Resolve requested member user IDs in one query ──────────────────
    const requestedMembers = dto.members ?? [];
    const requestedUserIds = requestedMembers.map((m) => m.userId);

    let foundUserIds = new Set<string>();
    let skippedUserIds: string[] = [];

    if (requestedUserIds.length > 0) {
      const foundUsers = await this.prisma.user.findMany({
        where: { id: { in: requestedUserIds }, isActive: true },
        select: { id: true },
      });
      foundUserIds = new Set(foundUsers.map((u) => u.id));
      skippedUserIds = requestedUserIds.filter((id) => !foundUserIds.has(id));
    }

    const validMembers = requestedMembers.filter((m) =>
      foundUserIds.has(m.userId),
    );

    // ── Pre-fetch all active global departments ──────────────────────────
    const globalDepts = await this.prisma.globalDepartment.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // ── Single transaction: company + departments + members ──────────────
    const company = await this.prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: dto.name,
          description: dto.description,
          inn: dto.inn,
          logo: dto.logo,
          address: dto.address,
          requisites: dto.requisites,
          requisites2: dto.requisites2,
          createdById,
        },
      });

      // Link all global departments to this company
      if (globalDepts.length > 0) {
        await tx.companyDepartmentConfig.createMany({
          data: globalDepts.map((dept) => ({
            companyId: created.id,
            globalDepartmentId: dept.id,
            isEnabled: true,
          })),
          skipDuplicates: true,
        });
      }

      // Attach valid members
      for (const member of validMembers) {
        const membership = await tx.userCompanyMembership.create({
          data: {
            userId: member.userId,
            companyId: created.id,
            rank: member.rank ?? null,
            isActive: true,
          },
        });

        const deptIds = member.allowedDepartmentIds ?? [];
        if (deptIds.length > 0) {
          await tx.membershipDepartmentAccess.createMany({
            data: deptIds.map((deptId) => ({
              userCompanyMembershipId: membership.id,
              globalDepartmentId: deptId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return created;
    });

    const companyData = await this.findOne(company.id);
    return { ...companyData, skippedUserIds };
  }

  async findAll(
    userId: string,
    systemRole: SystemRole | null,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    const isFin = is1FinStaff(systemRole);

    // Client users (CLIENT_* roles) → only companies they have membership in
    // 1FIN staff (FIN_* roles) → all companies
    if (!isFin) {
      where.memberships = {
        some: {
          userId,
          isActive: true,
        },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inn: { contains: search, mode: 'insensitive' } },
      ];
    }

    // For 1FIN users: standard query with _count
    if (isFin) {
      const [companies, total] = await Promise.all([
        this.prisma.company.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            inn: true,
            logo: true,
            address: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                memberships: { where: { isActive: true } },
                departmentConfigs: { where: { isEnabled: true } },
              },
            },
          },
        }),
        this.prisma.company.count({ where }),
      ]);

      return {
        data: companies,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    // For Client users: get companies with their allowed department count
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          inn: true,
          logo: true,
          address: true,
          isActive: true,
          createdAt: true,
          memberships: {
            where: { userId, isActive: true },
            select: {
              _count: {
                select: { allowedDepartments: true },
              },
            },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    // Transform to match 1FIN response format
    const data = companies.map((company) => {
      const membership = company.memberships[0];
      const departmentCount = membership?._count?.allowedDepartments ?? 0;

      return {
        id: company.id,
        name: company.name,
        inn: company.inn,
        logo: company.logo,
        address: company.address,
        isActive: company.isActive,
        createdAt: company.createdAt,
        _count: {
          memberships: 1, // Client always has 1 membership per company
          departmentConfigs: departmentCount,
        },
      };
    });

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    userId?: string,
    systemRole?: SystemRole | null,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        inn: true,
        logo: true,
        address: true,
        requisites: true,
        requisites2: true,
        isActive: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            memberships: { where: { isActive: true } },
          },
        },
      },
    });

    if (!company || !company.isActive) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    // Check access for client users (when userId is provided)
    if (userId && !is1FinStaff(systemRole)) {
      const membership = await this.prisma.userCompanyMembership.findUnique({
        where: { userId_companyId: { userId, companyId: id } },
      });

      if (!membership || !membership.isActive) {
        throw new ForbiddenException('Sizda bu kompaniyaga kirish huquqi yo\'q');
      }
    }

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);

    if (dto.inn) {
      const existing = await this.prisma.company.findUnique({
        where: { inn: dto.inn },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Bu INN bilan kompaniya allaqachon mavjud');
      }
    }

    await this.prisma.company.update({
      where: { id },
      data: dto,
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.company.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: "Kompaniya o'chirildi" };
  }

  async updateLogo(id: string, logoPath: string) {
    await this.findOne(id);

    await this.prisma.company.update({
      where: { id },
      data: { logo: logoPath },
    });

    return this.findOne(id);
  }

  // ─────────────────────────────────────────────
  // DEPARTMENT CONFIG MANAGEMENT
  // ─────────────────────────────────────────────

  /**
   * Get department configs for a company filtered by user access.
   * - 1FIN users: all enabled departments
   * - Client users: only departments they have access to via membership
   */
  async getDepartmentConfigs(
    companyId: string,
    userId: string,
    systemRole: SystemRole | null,
  ) {
    // Check company exists and user has access
    await this.findOne(companyId, userId, systemRole);

    // 1FIN users see all enabled departments
    if (is1FinStaff(systemRole)) {
      return this.prisma.companyDepartmentConfig.findMany({
        where: { companyId, isEnabled: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          isEnabled: true,
          globalDepartment: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }

    // Client users: get departments from their membership access
    const membership = await this.prisma.userCompanyMembership.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: {
        allowedDepartments: {
          select: {
            globalDepartment: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    if (!membership) {
      return [];
    }

    // Return in same format as 1FIN response
    return membership.allowedDepartments.map((ad) => ({
      id: ad.globalDepartment.id,
      isEnabled: true,
      globalDepartment: ad.globalDepartment,
    }));
  }

  /**
   * Enable a department for a company.
   */
  async enableDepartment(companyId: string, globalDepartmentId: string) {
    await this.findOne(companyId);

    const config = await this.prisma.companyDepartmentConfig.findUnique({
      where: {
        companyId_globalDepartmentId: { companyId, globalDepartmentId },
      },
    });

    if (!config) {
      // Create config if it doesn't exist
      return this.prisma.companyDepartmentConfig.create({
        data: { companyId, globalDepartmentId, isEnabled: true },
        select: {
          id: true,
          isEnabled: true,
          globalDepartment: { select: { id: true, name: true, slug: true } },
        },
      });
    }

    return this.prisma.companyDepartmentConfig.update({
      where: {
        companyId_globalDepartmentId: { companyId, globalDepartmentId },
      },
      data: { isEnabled: true },
      select: {
        id: true,
        isEnabled: true,
        globalDepartment: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Disable a department for a company.
   */
  async disableDepartment(companyId: string, globalDepartmentId: string) {
    await this.findOne(companyId);

    const config = await this.prisma.companyDepartmentConfig.findUnique({
      where: {
        companyId_globalDepartmentId: { companyId, globalDepartmentId },
      },
    });

    if (!config) {
      throw new NotFoundException('Department bu kompaniya uchun topilmadi');
    }

    return this.prisma.companyDepartmentConfig.update({
      where: {
        companyId_globalDepartmentId: { companyId, globalDepartmentId },
      },
      data: { isEnabled: false },
      select: {
        id: true,
        isEnabled: true,
        globalDepartment: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * Get all active members of a company with their roles and department access.
   */
  async getMembers(companyId: string) {
    await this.findOne(companyId);

    return this.prisma.userCompanyMembership.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rank: true,
        isActive: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            avatar: true,
            systemRole: true,
            isActive: true,
          },
        },
        allowedDepartments: {
          select: {
            globalDepartment: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // DELETED COMPANIES MANAGEMENT (Admin only)
  // ─────────────────────────────────────────────

  /**
   * Get all soft-deleted companies (Admin only)
   */
  async findAllDeleted(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: false };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { inn: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          inn: true,
          logo: true,
          address: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Restore a soft-deleted company (Admin only)
   */
  async restore(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    if (company.isActive) {
      throw new ConflictException('Bu kompaniya allaqachon faol');
    }

    await this.prisma.company.update({
      where: { id },
      data: { isActive: true },
    });

    return this.findOne(id);
  }

  /**
   * Permanently delete a company (Admin only)
   */
  async permanentDelete(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    if (company.isActive) {
      throw new ConflictException(
        "Faqat o'chirilgan kompaniyalarni butunlay o'chirish mumkin",
      );
    }

    await this.prisma.company.delete({
      where: { id },
    });

    return { message: "Kompaniya butunlay o'chirildi" };
  }
}
