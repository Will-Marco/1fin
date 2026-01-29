import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto, AddMemberDto } from './dto';

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

  async create(companyId: string, dto: CreateDepartmentDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company || !company.isActive) {
      throw new NotFoundException('Company not found');
    }

    const slug = this.generateSlug(dto.name);

    const existing = await this.prisma.department.findUnique({
      where: { companyId_slug: { companyId, slug } },
    });
    if (existing) {
      throw new ConflictException('Department with this name already exists');
    }

    return this.prisma.department.create({
      data: {
        companyId,
        name: dto.name,
        slug,
        isDefault: false,
      },
    });
  }

  async findAll(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company || !company.isActive) {
      throw new NotFoundException('Company not found');
    }

    return this.prisma.department.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
  }

  async findOne(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  async update(companyId: string, departmentId: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.isDefault) {
      throw new ForbiddenException('Cannot update default department');
    }

    const updateData: any = {};

    if (dto.name) {
      const slug = this.generateSlug(dto.name);

      const existing = await this.prisma.department.findFirst({
        where: {
          companyId,
          slug,
          id: { not: departmentId },
        },
      });
      if (existing) {
        throw new ConflictException('Department with this name already exists');
      }

      updateData.name = dto.name;
      updateData.slug = slug;
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async remove(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.isDefault) {
      throw new ForbiddenException('Cannot delete default department');
    }

    await this.prisma.department.update({
      where: { id: departmentId },
      data: { isActive: false },
    });

    return { message: 'Department deleted successfully' };
  }

  async addMember(companyId: string, departmentId: string, dto: AddMemberDto) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Check if user belongs to this company
    const userInCompany = await this.prisma.userCompany.findFirst({
      where: { userId: dto.userId, companyId, isActive: true },
    });

    const operatorInCompany = await this.prisma.operatorCompany.findFirst({
      where: { operatorId: dto.userId, companyId, isActive: true },
    });

    if (!userInCompany && !operatorInCompany) {
      throw new ForbiddenException('User does not belong to this company');
    }

    const existing = await this.prisma.departmentMember.findUnique({
      where: {
        userId_departmentId: { userId: dto.userId, departmentId },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this department');
    }

    await this.prisma.departmentMember.create({
      data: {
        userId: dto.userId,
        departmentId,
      },
    });

    return this.getMembers(companyId, departmentId);
  }

  async removeMember(companyId: string, departmentId: string, userId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const member = await this.prisma.departmentMember.findUnique({
      where: {
        userId_departmentId: { userId, departmentId },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this department');
    }

    await this.prisma.departmentMember.delete({
      where: { id: member.id },
    });

    return { message: 'Member removed successfully' };
  }

  async getMembers(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, isActive: true },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const members = await this.prisma.departmentMember.findMany({
      where: { departmentId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            role: true,
            workerType: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      ...m.user,
      joinedAt: m.createdAt,
    }));
  }
}
