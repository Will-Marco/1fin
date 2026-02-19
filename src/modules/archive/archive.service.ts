import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface ArchiveResult {
  messagesArchived: number;
  filesArchived: number;
  documentsArchived: number;
  messageEditsDeleted: number;
  messageForwardsDeleted: number;
}

export interface SearchArchiveParams {
  globalDepartmentId?: string;
  companyId?: string;
  senderId?: string;
  content?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);
  private readonly ARCHIVE_MONTHS = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 3 oydan eski xabarlar va hujjatlarni arxivlash
   */
  async archiveOldData(): Promise<ArchiveResult> {
    const cutoffDate = this.getCutoffDate();

    this.logger.log(
      `Starting archive process for data older than ${cutoffDate.toISOString()}`,
    );

    const result: ArchiveResult = {
      messagesArchived: 0,
      filesArchived: 0,
      documentsArchived: 0,
      messageEditsDeleted: 0,
      messageForwardsDeleted: 0,
    };

    // 1. Xabarlarni arxivlash
    const messagesToArchive = await this.prisma.message.findMany({
      where: { createdAt: { lt: cutoffDate } },
      include: {
        files: true,
        edits: true,
        forwards: true,
      },
    });

    if (messagesToArchive.length > 0) {
      this.logger.log(`Archiving ${messagesToArchive.length} messages`);
      await this.prisma.$transaction(async (tx) => {
        for (const message of messagesToArchive) {
          await tx.messageArchive.create({
            data: {
              id: message.id,
              globalDepartmentId: message.globalDepartmentId,
              companyId: message.companyId,
              senderId: message.senderId,
              content: message.content,
              type: message.type,
              voiceDuration: message.voiceDuration,
              replyToId: message.replyToId,
              isDeleted: message.isDeleted,
              deletedAt: message.deletedAt,
              deletedBy: message.deletedBy,
              isEdited: message.isEdited,
              parentId: message.parentId,
              status: message.status,
              isOutgoing: message.isOutgoing,
              createdAt: message.createdAt,
            },
          });
          result.messagesArchived++;

          for (const file of message.files) {
            await tx.fileArchive.create({
              data: {
                id: file.id,
                globalDepartmentId: file.globalDepartmentId,
                messageId: file.messageId,
                documentId: file.documentId,
                uploadedBy: file.uploadedBy,
                originalName: file.originalName,
                fileName: file.fileName,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
                fileType: file.fileType,
                path: file.path,
                isOutgoing: file.isOutgoing,
                isDeleted: file.isDeleted,
                deletedAt: file.deletedAt,
                deletedBy: file.deletedBy,
                createdAt: file.createdAt,
              },
            });
            result.filesArchived++;
          }

          result.messageEditsDeleted += message.edits.length;
          result.messageForwardsDeleted += message.forwards.length;
        }

        const messageIds = messagesToArchive.map((m) => m.id);
        await tx.file.deleteMany({ where: { messageId: { in: messageIds } } });
        await tx.messageEdit.deleteMany({ where: { messageId: { in: messageIds } } });
        await tx.messageForward.deleteMany({ where: { messageId: { in: messageIds } } });
        await tx.message.deleteMany({ where: { id: { in: messageIds } } });
      });
    }

    // 2. Hujjatlarni arxivlash
    const documentsToArchive = await this.prisma.document.findMany({
      where: { createdAt: { lt: cutoffDate } },
      include: { files: true },
    });

    if (documentsToArchive.length > 0) {
      this.logger.log(`Archiving ${documentsToArchive.length} documents`);
      await this.prisma.$transaction(async (tx) => {
        for (const doc of documentsToArchive) {
          await tx.documentArchive.create({
            data: {
              id: doc.id,
              globalDepartmentId: doc.globalDepartmentId,
              companyId: doc.companyId,
              documentName: doc.documentName,
              documentNumber: doc.documentNumber,
              status: doc.status,
              rejectionReason: doc.rejectionReason,
              createdById: doc.createdById,
              approvedById: doc.approvedById,
              approvedAt: doc.approvedAt,
              expiresAt: doc.expiresAt,
              createdAt: doc.createdAt,
            },
          });
          result.documentsArchived++;

          for (const file of doc.files) {
            // Agar fayl xabar orqali arxivlanmagan bo'lsa (orphan file check)
            const exists = await tx.fileArchive.findUnique({ where: { id: file.id } });
            if (!exists) {
              await tx.fileArchive.create({
                data: {
                  id: file.id,
                  globalDepartmentId: file.globalDepartmentId,
                  messageId: file.messageId,
                  documentId: file.documentId,
                  uploadedBy: file.uploadedBy,
                  originalName: file.originalName,
                  fileName: file.fileName,
                  fileSize: file.fileSize,
                  mimeType: file.mimeType,
                  fileType: file.fileType,
                  path: file.path,
                  isOutgoing: file.isOutgoing,
                  isDeleted: file.isDeleted,
                  deletedAt: file.deletedAt,
                  deletedBy: file.deletedBy,
                  createdAt: file.createdAt,
                },
              });
              result.filesArchived++;
            }
          }
        }

        const docIds = documentsToArchive.map((d) => d.id);
        await tx.file.deleteMany({ where: { documentId: { in: docIds } } });
        await tx.documentActionLog.deleteMany({ where: { documentId: { in: docIds } } });
        await tx.document.deleteMany({ where: { id: { in: docIds } } });
      });
    }

    return result;
  }

  /**
   * Xabarga yoki hujjatga bog'lanmagan eski fayllarni arxivlash
   */
  async archiveOrphanFiles(): Promise<number> {
    const cutoffDate = this.getCutoffDate();

    const filesToArchive = await this.prisma.file.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        messageId: null,
        documentId: null,
      },
    });

    if (filesToArchive.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const file of filesToArchive) {
        await tx.fileArchive.create({
          data: {
            id: file.id,
            globalDepartmentId: file.globalDepartmentId,
            messageId: file.messageId,
            documentId: file.documentId,
            uploadedBy: file.uploadedBy,
            originalName: file.originalName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            fileType: file.fileType,
            path: file.path,
            isOutgoing: file.isOutgoing,
            isDeleted: file.isDeleted,
            deletedAt: file.deletedAt,
            deletedBy: file.deletedBy,
            createdAt: file.createdAt,
          },
        });
      }

      await tx.file.deleteMany({
        where: { id: { in: filesToArchive.map((f) => f.id) } },
      });
    });

    return filesToArchive.length;
  }

  /**
   * Arxivlangan xabarlarni qidirish
   */
  async searchMessages(params: SearchArchiveParams) {
    const { globalDepartmentId, companyId, senderId, content, startDate, endDate, page = 1, limit = 20 } = params;
    const where: Prisma.MessageArchiveWhereInput = {};

    if (globalDepartmentId) where.globalDepartmentId = globalDepartmentId;
    if (companyId) where.companyId = companyId;
    if (senderId) where.senderId = senderId;
    if (content) where.content = { contains: content, mode: 'insensitive' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [messages, total] = await Promise.all([
      this.prisma.messageArchive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.messageArchive.count({ where }),
    ]);

    return {
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Arxivlangan fayllarni qidirish
   */
  async searchFiles(params: SearchArchiveParams & { fileName?: string }) {
    const { globalDepartmentId, fileName, startDate, endDate, page = 1, limit = 20 } = params;
    const where: Prisma.FileArchiveWhereInput = {};

    if (globalDepartmentId) where.globalDepartmentId = globalDepartmentId;
    if (fileName) where.originalName = { contains: fileName, mode: 'insensitive' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [files, total] = await Promise.all([
      this.prisma.fileArchive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fileArchive.count({ where }),
    ]);

    return {
      data: files,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Arxivlangan hujjatlarni qidirish
   */
  async searchDocuments(params: SearchArchiveParams & { documentNumber?: string; documentName?: string }) {
    const { globalDepartmentId, companyId, documentNumber, documentName, startDate, endDate, page = 1, limit = 20 } = params;
    const where: Prisma.DocumentArchiveWhereInput = {};

    if (globalDepartmentId) where.globalDepartmentId = globalDepartmentId;
    if (companyId) where.companyId = companyId;
    if (documentNumber) where.documentNumber = { contains: documentNumber, mode: 'insensitive' };
    if (documentName) where.documentName = { contains: documentName, mode: 'insensitive' };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [documents, total] = await Promise.all([
      this.prisma.documentArchive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.documentArchive.count({ where }),
    ]);

    return {
      data: documents,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Arxiv statistikasi
   */
  async getStatistics() {
    const [messagesCount, filesCount, documentsCount] = await Promise.all([
      this.prisma.messageArchive.count(),
      this.prisma.fileArchive.count(),
      this.prisma.documentArchive.count(),
    ]);

    return {
      messages: messagesCount,
      files: filesCount,
      documents: documentsCount,
    };
  }

  private getCutoffDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - this.ARCHIVE_MONTHS);
    return date;
  }
}
