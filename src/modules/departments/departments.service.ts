import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
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
        throw new ConflictException('Bu slug bilan department allaqachon mavjud');
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

    return { message: 'Global department o\'chirildi' };
  }
}
