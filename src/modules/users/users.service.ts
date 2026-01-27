import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateUserDto,
  UpdateUserDto,
  AssignCompanyDto,
  CreateWorkerTypeDto,
} from './dto';
import { DEFAULT_PASSWORD } from '../../common/constants';
import { Role } from '../../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, currentUserRole: Role) {
    if (dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot create SUPER_ADMIN user');
    }

    if (dto.role === Role.ADMIN && currentUserRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only SUPER_ADMIN can create ADMIN users');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    if (
      (dto.role === Role.OPERATOR || dto.role === Role.EMPLOYEE) &&
      !dto.workerTypeId
    ) {
      throw new BadRequestException(
        'workerTypeId is required for OPERATOR and EMPLOYEE roles',
      );
    }

    if (dto.workerTypeId) {
      const workerType = await this.prisma.workerType.findUnique({
        where: { id: dto.workerTypeId },
      });
      if (!workerType || !workerType.isActive) {
        throw new NotFoundException('Worker type not found');
      }
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        workerTypeId: dto.workerTypeId,
        mustChangePassword: true,
      },
    });

    return this.findOne(user.id);
  }

  async findAll(
    page = 1,
    limit = 20,
    role?: Role,
    companyId?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (role) where.role = role;

    if (companyId) {
      where.OR = [
        { userCompanies: { some: { companyId, isActive: true } } },
        { operatorCompanies: { some: { companyId, isActive: true } } },
      ];
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
          role: true,
          isActive: true,
          mustChangePassword: true,
          workerType: { select: { id: true, name: true } },
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
        role: true,
        isActive: true,
        mustChangePassword: true,
        workerType: { select: { id: true, name: true } },
        userCompanies: {
          where: { isActive: true },
          include: {
            company: { select: { id: true, name: true, inn: true } },
          },
        },
        operatorCompanies: {
          where: { isActive: true },
          include: {
            company: { select: { id: true, name: true, inn: true } },
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.workerTypeId) {
      const workerType = await this.prisma.workerType.findUnique({
        where: { id: dto.workerTypeId },
      });
      if (!workerType || !workerType.isActive) {
        throw new NotFoundException('Worker type not found');
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const user = await this.findOne(id);

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete SUPER_ADMIN user');
    }

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'User deleted successfully' };
  }

  async assignCompany(userId: string, dto: AssignCompanyDto) {
    const user = await this.findOne(userId);

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company || !company.isActive) {
      throw new NotFoundException('Company not found');
    }

    if (user.role === Role.OPERATOR) {
      const existing = await this.prisma.operatorCompany.findUnique({
        where: {
          operatorId_companyId: { operatorId: userId, companyId: dto.companyId },
        },
      });
      if (existing) {
        throw new ConflictException('Operator already assigned to this company');
      }

      await this.prisma.operatorCompany.create({
        data: { operatorId: userId, companyId: dto.companyId },
      });
    } else if (
      ([Role.FOUNDER, Role.DIRECTOR, Role.EMPLOYEE] as string[]).includes(user.role as string)
    ) {
      if (user.role !== Role.FOUNDER) {
        const existingAssignment = await this.prisma.userCompany.findFirst({
          where: { userId, isActive: true },
        });
        if (existingAssignment) {
          throw new ConflictException(
            `${user.role} can only be assigned to one company`,
          );
        }
      }

      const existing = await this.prisma.userCompany.findUnique({
        where: {
          userId_companyId: { userId, companyId: dto.companyId },
        },
      });
      if (existing) {
        throw new ConflictException('User already assigned to this company');
      }

      await this.prisma.userCompany.create({
        data: { userId, companyId: dto.companyId },
      });
    } else {
      throw new BadRequestException(
        'SUPER_ADMIN and ADMIN cannot be assigned to companies',
      );
    }

    return this.findOne(userId);
  }

  async unassignCompany(userId: string, companyId: string) {
    const user = await this.findOne(userId);

    if (user.role === Role.OPERATOR) {
      const assignment = await this.prisma.operatorCompany.findUnique({
        where: {
          operatorId_companyId: { operatorId: userId, companyId },
        },
      });
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }
      await this.prisma.operatorCompany.delete({
        where: { id: assignment.id },
      });
    } else {
      const assignment = await this.prisma.userCompany.findUnique({
        where: {
          userId_companyId: { userId, companyId },
        },
      });
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }
      await this.prisma.userCompany.delete({
        where: { id: assignment.id },
      });
    }

    return this.findOne(userId);
  }

  // WorkerType CRUD

  async createWorkerType(dto: CreateWorkerTypeDto) {
    const existing = await this.prisma.workerType.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Worker type with this name already exists');
    }

    return this.prisma.workerType.create({
      data: { name: dto.name },
    });
  }

  async findAllWorkerTypes() {
    return this.prisma.workerType.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async removeWorkerType(id: string) {
    const workerType = await this.prisma.workerType.findUnique({
      where: { id },
    });
    if (!workerType) {
      throw new NotFoundException('Worker type not found');
    }

    await this.prisma.workerType.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Worker type deleted successfully' };
  }
}
