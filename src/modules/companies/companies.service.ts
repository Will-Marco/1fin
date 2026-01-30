import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_DEPARTMENTS } from '../../common/constants';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCompanyDto, createdById: string) {
    if (dto.inn) {
      const existing = await this.prisma.company.findUnique({
        where: { inn: dto.inn },
      });
      if (existing) {
        throw new ConflictException('Company with this INN already exists');
      }
    }

    const company = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          inn: dto.inn,
          address: dto.address,
          createdById,
        },
      });

      await tx.department.createMany({
        data: DEFAULT_DEPARTMENTS.map((dept) => ({
          companyId: company.id,
          name: dept.name,
          slug: dept.slug,
          isDefault: true,
        })),
      });
      return company;
    });

    return this.findOne(company.id);
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          departments: {
            where: { isActive: true },
            select: { id: true, name: true, slug: true, isDefault: true },
          },
          _count: {
            select: {
              userCompanies: true,
              operatorCompanies: true,
            },
          },
        },
      }),
      this.prisma.company.count({ where: { isActive: true } }),
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
      include: {
        departments: {
          where: { isActive: true },
          select: { id: true, name: true, slug: true, isDefault: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            userCompanies: true,
            operatorCompanies: true,
          },
        },
      },
    });

    if (!company || !company.isActive) {
      throw new NotFoundException('Company not found');
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
        throw new ConflictException('Company with this INN already exists');
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

    return { message: 'Company deleted successfully' };
  }

  async updateLogo(id: string, logoPath: string) {
    await this.findOne(id);

    await this.prisma.company.update({
      where: { id },
      data: { logo: logoPath },
    });

    return this.findOne(id);
  }
}
