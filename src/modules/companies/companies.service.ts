import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a company and automatically link ALL active GlobalDepartments
   * via CompanyDepartmentConfig (enabled by default).
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

    // Get all active global departments
    const globalDepts = await this.prisma.globalDepartment.findMany({
      where: { isActive: true },
      select: { id: true },
    });

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

      return created;
    });

    return this.findOne(company.id);
  }

  async findAll(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };

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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
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
        departmentConfigs: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            isEnabled: true,
            globalDepartment: {
              select: { id: true, name: true, slug: true, isActive: true },
            },
          },
        },
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

    return { message: 'Kompaniya o\'chirildi' };
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
   * Get all department configs for a company (enabled + disabled).
   */
  async getDepartmentConfigs(companyId: string) {
    await this.findOne(companyId);

    return this.prisma.companyDepartmentConfig.findMany({
      where: { companyId },
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

  /**
   * Enable a department for a company.
   */
  async enableDepartment(companyId: string, globalDepartmentId: string) {
    await this.findOne(companyId);

    const config = await this.prisma.companyDepartmentConfig.findUnique({
      where: { companyId_globalDepartmentId: { companyId, globalDepartmentId } },
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
      where: { companyId_globalDepartmentId: { companyId, globalDepartmentId } },
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
      where: { companyId_globalDepartmentId: { companyId, globalDepartmentId } },
    });

    if (!config) {
      throw new NotFoundException('Department bu kompaniya uchun topilmadi');
    }

    return this.prisma.companyDepartmentConfig.update({
      where: { companyId_globalDepartmentId: { companyId, globalDepartmentId } },
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
        'Faqat o\'chirilgan kompaniyalarni butunlay o\'chirish mumkin',
      );
    }

    await this.prisma.company.delete({
      where: { id },
    });

    return { message: 'Kompaniya butunlay o\'chirildi' };
  }
}
