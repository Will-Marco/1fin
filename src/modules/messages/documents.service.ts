import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RejectDocumentDto } from './dto';
import { Role, DocumentStatus } from '../../../generated/prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  private async checkCompanyAccess(
    companyId: string,
    userId: string,
    userRole: Role,
  ): Promise<boolean> {
    // SUPER_ADMIN va ADMIN barcha kompaniyalarga kirishi mumkin
    if (userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN) {
      return true;
    }

    // Check UserCompany
    const userCompany = await this.prisma.userCompany.findFirst({
      where: { userId, companyId, isActive: true },
    });

    if (userCompany) return true;

    // Check OperatorCompany
    const operatorCompany = await this.prisma.operatorCompany.findFirst({
      where: { operatorId: userId, companyId, isActive: true },
    });

    return !!operatorCompany;
  }

  async approve(documentId: string, userId: string, userRole: Role) {
    const document = await this.prisma.documentApproval.findUnique({
      where: { id: documentId },
      include: {
        message: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== DocumentStatus.PENDING) {
      throw new BadRequestException('Document is already processed');
    }

    // Check company access
    const hasAccess = await this.checkCompanyAccess(
      document.message.department.companyId,
      userId,
      userRole,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this company');
    }

    // Only FOUNDER, DIRECTOR, EMPLOYEE can approve (not OPERATOR)
    if (
      userRole !== Role.SUPER_ADMIN &&
      userRole !== Role.ADMIN &&
      userRole !== Role.FOUNDER &&
      userRole !== Role.DIRECTOR &&
      userRole !== Role.EMPLOYEE
    ) {
      throw new ForbiddenException('You are not allowed to approve documents');
    }

    const updated = await this.prisma.documentApproval.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, username: true, name: true },
            },
          },
        },
        approver: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    return updated;
  }

  async reject(
    documentId: string,
    dto: RejectDocumentDto,
    userId: string,
    userRole: Role,
  ) {
    const document = await this.prisma.documentApproval.findUnique({
      where: { id: documentId },
      include: {
        message: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== DocumentStatus.PENDING) {
      throw new BadRequestException('Document is already processed');
    }

    // Check company access
    const hasAccess = await this.checkCompanyAccess(
      document.message.department.companyId,
      userId,
      userRole,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this company');
    }

    // Only FOUNDER, DIRECTOR, EMPLOYEE can reject
    if (
      userRole !== Role.SUPER_ADMIN &&
      userRole !== Role.ADMIN &&
      userRole !== Role.FOUNDER &&
      userRole !== Role.DIRECTOR &&
      userRole !== Role.EMPLOYEE
    ) {
      throw new ForbiddenException('You are not allowed to reject documents');
    }

    const updated = await this.prisma.documentApproval.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.REJECTED,
        rejectionReason: dto.reason,
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, username: true, name: true },
            },
          },
        },
        approver: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    return updated;
  }

  async getPending(companyId: string, userId: string, userRole: Role) {
    // Check company access
    const hasAccess = await this.checkCompanyAccess(companyId, userId, userRole);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this company');
    }

    const pendingDocuments = await this.prisma.documentApproval.findMany({
      where: {
        status: DocumentStatus.PENDING,
        message: {
          department: {
            companyId,
          },
        },
      },
      include: {
        message: {
          include: {
            sender: {
              select: { id: true, username: true, name: true, role: true },
            },
            department: {
              select: { id: true, name: true, slug: true },
            },
            files: {
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                mimeType: true,
                s3Key: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pendingDocuments;
  }

  async getAll(
    companyId: string,
    userId: string,
    userRole: Role,
    status?: DocumentStatus,
    page = 1,
    limit = 20,
  ) {
    // Check company access
    const hasAccess = await this.checkCompanyAccess(companyId, userId, userRole);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this company');
    }

    const skip = (page - 1) * limit;

    const where: any = {
      message: {
        department: {
          companyId,
        },
      },
    };

    if (status) {
      where.status = status;
    }

    const [documents, total] = await Promise.all([
      this.prisma.documentApproval.findMany({
        where,
        skip,
        take: limit,
        include: {
          message: {
            include: {
              sender: {
                select: { id: true, username: true, name: true, role: true },
              },
              department: {
                select: { id: true, name: true, slug: true },
              },
              files: {
                select: {
                  id: true,
                  fileName: true,
                  fileSize: true,
                  mimeType: true,
                },
              },
            },
          },
          approver: {
            select: { id: true, username: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.documentApproval.count({ where }),
    ]);

    return {
      data: documents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
