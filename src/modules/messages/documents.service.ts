import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { DocumentStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentDto, RejectDocumentDto } from './dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new document.
   * Default status is PENDING.
   * expiresAt is set to 10 days from now.
   */
  async create(userId: string, dto: CreateDocumentDto) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 10);

    const document = await this.prisma.document.create({
      data: {
        documentName: dto.documentName,
        documentNumber: dto.documentNumber,
        companyId: dto.companyId,
        globalDepartmentId: dto.globalDepartmentId,
        createdById: userId,
        status: DocumentStatus.PENDING,
        expiresAt,
      },
      include: {
        company: { select: { name: true } },
        globalDepartment: { select: { name: true } },
        createdBy: { select: { id: true, username: true, name: true } },
      },
    });

    // Create action log
    await this.prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        userId,
        action: 'CREATED',
        details: { ...dto } as any,
      },
    });

    return document;
  }

  /**
   * Approve a document.
   * Only FIN_ADMIN/FIN_DIRECTOR or authorized company members.
   */
  async approve(documentId: string, userId: string) {
    const document = await this.findOne(documentId);

    if (document.status !== DocumentStatus.PENDING) {
      throw new BadRequestException('Document is already processed');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.ACCEPTED,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        approvedBy: { select: { id: true, username: true, name: true } },
      },
    });

    // Create action log
    await this.prisma.documentActionLog.create({
      data: {
        documentId,
        userId,
        action: 'ACCEPTED',
      },
    });

    return updated;
  }

  /**
   * Reject a document with a reason.
   */
  async reject(documentId: string, userId: string, dto: RejectDocumentDto) {
    const document = await this.findOne(documentId);

    if (document.status !== DocumentStatus.PENDING) {
      throw new BadRequestException('Document is already processed');
    }

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.REJECTED,
        rejectionReason: dto.reason,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        approvedBy: { select: { id: true, username: true, name: true } },
      },
    });

    // Create action log
    await this.prisma.documentActionLog.create({
      data: {
        documentId,
        userId,
        action: 'REJECTED',
        details: { reason: dto.reason },
      },
    });

    return updated;
  }

  /**
   * Find all documents with filters.
   */
  async findAll(
    page = 1,
    limit = 20,
    filters: {
      companyId?: string;
      globalDepartmentId?: string;
      status?: DocumentStatus;
      search?: string;
    } = {},
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.globalDepartmentId)
      where.globalDepartmentId = filters.globalDepartmentId;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { documentName: { contains: filters.search, mode: 'insensitive' } },
        { documentNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          globalDepartment: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, username: true, name: true } },
          approvedBy: { select: { id: true, username: true, name: true } },
          files: true,
        },
      }),
      this.prisma.document.count({ where }),
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

  /**
   * Get a single document by ID.
   */
  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        globalDepartment: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, username: true, name: true } },
        approvedBy: { select: { id: true, username: true, name: true } },
        files: true,
        actionLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document topilmadi');
    }

    return document;
  }
}
