import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface ArchiveResult {
  messagesArchived: number;
  filesArchived: number;
  documentApprovalsArchived: number;
  messageEditsDeleted: number;
  messageForwardsDeleted: number;
}

export interface SearchArchiveParams {
  departmentId?: string;
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
   * 3 oydan eski xabarlarni arxivlash
   */
  async archiveOldMessages(): Promise<ArchiveResult> {
    const cutoffDate = this.getCutoffDate();

    this.logger.log(
      `Starting archive process for messages older than ${cutoffDate.toISOString()}`,
    );

    const result: ArchiveResult = {
      messagesArchived: 0,
      filesArchived: 0,
      documentApprovalsArchived: 0,
      messageEditsDeleted: 0,
      messageForwardsDeleted: 0,
    };

    // Arxivlanadigan xabarlarni topish
    const messagesToArchive = await this.prisma.message.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      include: {
        files: true,
        documentApproval: true,
        edits: true,
        forwards: true,
      },
    });

    if (messagesToArchive.length === 0) {
      this.logger.log('No messages to archive');
      return result;
    }

    // Transaction ichida arxivlash
    await this.prisma.$transaction(async (tx) => {
      for (const message of messagesToArchive) {
        // 1. MessageArchive ga ko'chirish
        await tx.messageArchive.create({
          data: {
            id: message.id,
            departmentId: message.departmentId,
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

        // 2. Fayllarni arxivlash
        for (const file of message.files) {
          await tx.fileArchive.create({
            data: {
              id: file.id,
              departmentId: file.departmentId,
              messageId: file.messageId,
              uploadedBy: file.uploadedBy,
              originalName: file.originalName,
              fileName: file.fileName,
              fileSize: file.fileSize,
              mimeType: file.mimeType,
              fileType: file.fileType,
              path: file.path,
              documentNumber: file.documentNumber,
              status: file.status,
              isOutgoing: file.isOutgoing,
              isDeleted: file.isDeleted,
              deletedAt: file.deletedAt,
              deletedBy: file.deletedBy,
              createdAt: file.createdAt,
            },
          });
          result.filesArchived++;
        }

        // 3. DocumentApproval ni arxivlash
        if (message.documentApproval) {
          await tx.documentApprovalArchive.create({
            data: {
              id: message.documentApproval.id,
              messageId: message.documentApproval.messageId,
              documentName: message.documentApproval.documentName,
              documentNumber: message.documentApproval.documentNumber,
              status: message.documentApproval.status,
              rejectionReason: message.documentApproval.rejectionReason,
              approvedBy: message.documentApproval.approvedBy,
              approvedAt: message.documentApproval.approvedAt,
              createdAt: message.documentApproval.createdAt,
            },
          });
          result.documentApprovalsArchived++;
        }

        // 4. MessageEdit larni o'chirish
        result.messageEditsDeleted += message.edits.length;

        // 5. MessageForward larni o'chirish
        result.messageForwardsDeleted += message.forwards.length;
      }

      // Asosiy jadvallardan o'chirish (cascade bilan edits, forwards, files, documentApproval o'chadi)
      const messageIds = messagesToArchive.map((m) => m.id);

      // Fayllarni alohida o'chirish (cascade ishlamasa)
      await tx.file.deleteMany({
        where: { messageId: { in: messageIds } },
      });

      // DocumentApproval o'chirish
      await tx.documentApproval.deleteMany({
        where: { messageId: { in: messageIds } },
      });

      // MessageEdit o'chirish
      await tx.messageEdit.deleteMany({
        where: { messageId: { in: messageIds } },
      });

      // MessageForward o'chirish
      await tx.messageForward.deleteMany({
        where: { messageId: { in: messageIds } },
      });

      // Xabarlarni o'chirish
      await tx.message.deleteMany({
        where: { id: { in: messageIds } },
      });
    });

    this.logger.log(
      `Archive completed: ${result.messagesArchived} messages, ${result.filesArchived} files, ${result.documentApprovalsArchived} document approvals`,
    );

    return result;
  }

  /**
   * Xabarga bog'lanmagan eski fayllarni arxivlash
   */
  async archiveOrphanFiles(): Promise<number> {
    const cutoffDate = this.getCutoffDate();

    const filesToArchive = await this.prisma.file.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        messageId: null, // Xabarga bog'lanmagan
      },
    });

    if (filesToArchive.length === 0) {
      return 0;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const file of filesToArchive) {
        await tx.fileArchive.create({
          data: {
            id: file.id,
            departmentId: file.departmentId,
            messageId: file.messageId,
            uploadedBy: file.uploadedBy,
            originalName: file.originalName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            fileType: file.fileType,
            path: file.path,
            documentNumber: file.documentNumber,
            status: file.status,
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

    this.logger.log(`Archived ${filesToArchive.length} orphan files`);

    return filesToArchive.length;
  }

  /**
   * Arxivlangan xabarlarni qidirish
   */
  async searchMessages(params: SearchArchiveParams) {
    const { departmentId, senderId, content, startDate, endDate, page = 1, limit = 20 } = params;

    const where: Prisma.MessageArchiveWhereInput = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (senderId) {
      where.senderId = senderId;
    }

    if (content) {
      where.content = { contains: content, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Arxivlangan fayllarni qidirish
   */
  async searchFiles(params: SearchArchiveParams & { fileName?: string }) {
    const { departmentId, fileName, startDate, endDate, page = 1, limit = 20 } = params;

    const where: Prisma.FileArchiveWhereInput = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (fileName) {
      where.originalName = { contains: fileName, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
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
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Arxivlangan hujjat tasdiqlarini qidirish
   */
  async searchDocumentApprovals(
    params: SearchArchiveParams & { documentNumber?: string; documentName?: string },
  ) {
    const { documentNumber, documentName, startDate, endDate, page = 1, limit = 20 } = params;

    const where: Prisma.DocumentApprovalArchiveWhereInput = {};

    if (documentNumber) {
      where.documentNumber = { contains: documentNumber, mode: 'insensitive' };
    }

    if (documentName) {
      where.documentName = { contains: documentName, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    const [approvals, total] = await Promise.all([
      this.prisma.documentApprovalArchive.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.documentApprovalArchive.count({ where }),
    ]);

    return {
      data: approvals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Arxiv statistikasi
   */
  async getStatistics() {
    const [messagesCount, filesCount, documentApprovalsCount] = await Promise.all([
      this.prisma.messageArchive.count(),
      this.prisma.fileArchive.count(),
      this.prisma.documentApprovalArchive.count(),
    ]);

    return {
      messages: messagesCount,
      files: filesCount,
      documentApprovals: documentApprovalsCount,
    };
  }

  /**
   * Arxivlash chegarasi sanasini hisoblash (3 oy oldin)
   */
  private getCutoffDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - this.ARCHIVE_MONTHS);
    return date;
  }
}
