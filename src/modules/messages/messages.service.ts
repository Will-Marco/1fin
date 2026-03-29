import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
    Optional,
} from '@nestjs/common';
import { FileType, MessageStatus, MessageType, SystemRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessageProducer } from '../../queues/producers';
import {
    CreateMessageWithFilesDto,
    ForwardMessageDto,
    UpdateMessageDto,
} from './dto';
import { LETTERS_DEPARTMENT_SLUG } from '../../common/constants';
import { STORAGE_PROVIDER, StorageProvider, UploadedFile } from '../files/storage/storage.interface';

const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  VOICE: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'],
};

const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024,
  DOCUMENT: 15 * 1024 * 1024,
  VOICE: 5 * 1024 * 1024,
  OTHER: 10 * 1024 * 1024,
};

/**
 * Reply qilingan xabar uchun qisqacha ma'lumot
 * Frontend preview uchun optimallashtirilgan
 */
const REPLY_TO_SELECT = {
  id: true,
  content: true,
  type: true,
  voiceDuration: true,
  sender: {
    select: {
      id: true,
      name: true,
      username: true,
    },
  },
  files: {
    select: {
      id: true,
      fileType: true,
      originalName: true,
      mimeType: true,
    },
    take: 3, // Faqat birinchi 3 ta fayl (preview uchun)
  },
  _count: {
    select: {
      files: true,
    },
  },
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private messageProducer?: MessageProducer,
    @Optional() @Inject(STORAGE_PROVIDER) private storage?: StorageProvider,
  ) {}

  /**
   * Check if user has access to a specific department in a company.
   */
  private async checkAccess(
    companyId: string,
    globalDepartmentId: string,
    userId: string,
    userSystemRole?: SystemRole | null,
  ) {
    // 1FIN staff (FIN_DIRECTOR, FIN_ADMIN, FIN_EMPLOYEE) have global access
    if (userSystemRole) {
      return true;
    }

    // Client users must have an active membership with access to this department
    const membership = await this.prisma.userCompanyMembership.findFirst({
      where: {
        userId,
        companyId,
        isActive: true,
        allowedDepartments: {
          some: { globalDepartmentId },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Sizda ushbu bo\'limga kirish huquqi yo\'q');
    }

    return true;
  }

  async findAll(
    companyId: string,
    globalDepartmentId: string,
    userId: string,
    userSystemRole: SystemRole | null,
    page = 1,
    limit = 50,
  ) {
    await this.checkAccess(companyId, globalDepartmentId, userId, userSystemRole);

    const skip = (page - 1) * limit;

    // 1FIN staff sees all, others see only non-deleted
    const where: any = {
      companyId,
      globalDepartmentId,
    };
    if (!userSystemRole) {
      where.isDeleted = false;
    }

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true, systemRole: true },
          },
          replyTo: {
            select: REPLY_TO_SELECT,
          },
          deletedByUser: {
            select: { id: true, name: true, username: true, systemRole: true },
          },
          files: true,
          _count: { select: { edits: true } },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      data: messages.map((msg) => this.formatMessage(msg, userSystemRole)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(messageId: string, userId: string, userSystemRole: SystemRole | null) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatar: true, systemRole: true },
        },
        replyTo: {
          select: REPLY_TO_SELECT,
        },
        deletedByUser: {
          select: { id: true, name: true, username: true, systemRole: true },
        },
        files: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Xabar topilmadi');
    }

    await this.checkAccess(message.companyId, message.globalDepartmentId, userId, userSystemRole);

    return this.formatMessage(message, userSystemRole);
  }

  async update(
    messageId: string,
    dto: UpdateMessageDto,
    userId: string,
    userSystemRole: SystemRole | null,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Xabar topilmadi');
    if (message.senderId !== userId) {
      throw new ForbiddenException('Faqat o\'zingizning xabaringizni tahrirlashingiz mumkin');
    }
    if (message.isDeleted) throw new BadRequestException('O\'chirilgan xabarni tahrirlab bo\'lmaydi');
    if (message.type !== 'TEXT') throw new BadRequestException('Faqat matnli xabarlarni tahrirlash mumkin');

    // Save history
    await this.prisma.messageEdit.create({
      data: { messageId, content: message.content || '' },
    });

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, isEdited: true },
    });

    if (this.messageProducer) {
      await this.messageProducer.sendEditedMessage({
        messageId,
        // @ts-ignore
        companyId: message.companyId,
        globalDepartmentId: message.globalDepartmentId,
        content: dto.content,
        editedAt: new Date(),
      } as any);
    }

    return this.findOne(messageId, userId, userSystemRole);
  }

  async remove(messageId: string, userId: string, userSystemRole: SystemRole | null) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException('Xabar topilmadi');
    if (message.senderId !== userId && !userSystemRole) {
      throw new ForbiddenException('Xabarni o\'chirish huquqi yo\'q');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    if (this.messageProducer) {
      await this.messageProducer.sendDeletedMessage({
        messageId,
        // @ts-ignore
        companyId: message.companyId,
        globalDepartmentId: message.globalDepartmentId,
        deletedBy: userId,
        deletedAt: new Date(),
      } as any);
    }

    return { message: 'Xabar o\'chirildi' };
  }

  /**
   * Forward message to another department (only for FIN_* users)
   * Creates a new message in target department with reference to original
   */
  async forwardMessage(
    messageId: string,
    dto: { toDepartmentId: string; companyId: string; note?: string },
    userId: string,
    userSystemRole: SystemRole,
  ) {
    // 1. Verify user is FIN_* (only 1FIN staff can forward)
    const isFINUser = (
      [
        SystemRole.FIN_DIRECTOR,
        SystemRole.FIN_ADMIN,
        SystemRole.FIN_EMPLOYEE,
      ] as SystemRole[]
    ).includes(userSystemRole);

    if (!isFINUser) {
      throw new ForbiddenException(
        'Faqat 1FIN xodimlari forward qilish huquqiga ega',
      );
    }

    // 2. Find original message with files
    const originalMessage = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        files: true,
        globalDepartment: { select: { id: true, name: true, slug: true } },
        forwardedAsNew: {
          include: {
            originalMessage: {
              select: {
                id: true,
                senderId: true,
                sender: { select: { id: true, name: true, username: true } },
              },
            },
          },
        },
      },
    });

    if (!originalMessage) {
      throw new NotFoundException('Xabar topilmadi');
    }

    // 3. Check if this message itself was forwarded - find root original sender
    let rootOriginalMessage = originalMessage;
    if (originalMessage.forwardedAsNew && originalMessage.forwardedAsNew.length > 0) {
      // This message was forwarded, get the root original
      rootOriginalMessage = originalMessage.forwardedAsNew[0].originalMessage as any;
    }

    // 4. Verify same company
    if (originalMessage.companyId !== dto.companyId) {
      throw new BadRequestException(
        'Forward faqat bir company ichida mumkin',
      );
    }

    // 5. Verify target department exists and enabled for company
    const targetDeptConfig =
      await this.prisma.companyDepartmentConfig.findUnique({
        where: {
          companyId_globalDepartmentId: {
            companyId: dto.companyId,
            globalDepartmentId: dto.toDepartmentId,
          },
        },
      });

    if (!targetDeptConfig || !targetDeptConfig.isEnabled) {
      throw new BadRequestException(
        'Target department bu kompaniya uchun mavjud emas',
      );
    }

    // 6. Create new message in target department
    const forwardedMessage = await this.prisma.message.create({
      data: {
        companyId: dto.companyId,
        globalDepartmentId: dto.toDepartmentId,
        senderId: userId,
        content: originalMessage.content,
        type: originalMessage.type,
        status: MessageStatus.SENT,
      },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        globalDepartment: { select: { id: true, name: true, slug: true } },
      },
    });

    // 7. Create MessageForward record
    await this.prisma.messageForward.create({
      data: {
        forwardedMessageId: forwardedMessage.id,
        originalMessageId: rootOriginalMessage.id,
        forwardedBy: userId,
        note: dto.note,
      },
    });

    // 8. Link original files to forwarded message (reference, not copy)
    if (originalMessage.files && originalMessage.files.length > 0) {
      await this.prisma.file.createMany({
        data: originalMessage.files.map((file) => ({
          globalDepartmentId: dto.toDepartmentId,
          messageId: forwardedMessage.id,
          uploadedBy: userId,
          originalName: file.originalName,
          fileName: file.fileName, // Same file reference
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          fileType: file.fileType,
          path: file.path, // Same path - no copy
          isOutgoing: true,
        })),
      });
    }

    // 9. Send notification via RabbitMQ (if available)
    if (this.messageProducer) {
      await this.messageProducer.sendNewMessage({
        messageId: forwardedMessage.id,
        companyId: dto.companyId,
        globalDepartmentId: dto.toDepartmentId,
        senderId: userId,
        type: originalMessage.type,
        isForwarded: true,
        originalSender: rootOriginalMessage.sender,
      } as any);
    }

    // 10. Return formatted message with forward info
    return {
      ...forwardedMessage,
      forwardedFrom: {
        originalSender: rootOriginalMessage.sender,
        department: originalMessage.globalDepartment,
      },
      note: dto.note,
      files: originalMessage.files,
    };
  }

  private formatMessage(message: any, userSystemRole: SystemRole | null) {
    if (message.isDeleted && !userSystemRole) {
      return {
        ...message,
        content: 'Bu xabar o\'chirilgan',
      };
    }
    return message;
  }

  /**
   * Xabar + fayllarni atomic tarzda yaratish (transaction bilan)
   */
  async createWithFiles(
    userId: string,
    userSystemRole: SystemRole | null,
    dto: CreateMessageWithFilesDto,
    files: Express.Multer.File[],
  ) {
    if (!this.storage) {
      throw new BadRequestException('Storage provider mavjud emas');
    }

    // Validation
    if (!dto.companyId || !dto.globalDepartmentId) {
      throw new BadRequestException('companyId va globalDepartmentId majburiy');
    }

    // Fayl yoki content majburiy
    if (!files?.length && !dto.content?.trim()) {
      throw new BadRequestException('Kamida bitta fayl yoki matn bo\'lishi kerak');
    }

    await this.checkAccess(dto.companyId, dto.globalDepartmentId, userId, userSystemRole);

    // Xatlar special rule
    const department = await this.prisma.globalDepartment.findUnique({
      where: { id: dto.globalDepartmentId },
    });

    if (department?.slug === LETTERS_DEPARTMENT_SLUG && !userSystemRole) {
      throw new ForbiddenException(
        "Xatlar bo'limida mijozlar xabar yoza olmaydi",
      );
    }

    // Reply validation
    if (dto.replyToId) {
      const replyToMessage = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, companyId: dto.companyId, isDeleted: false },
      });
      if (!replyToMessage) {
        throw new NotFoundException('Reply qilinayotgan xabar topilmadi');
      }
    }

    // Fayllarni validatsiya qilish
    for (const file of files || []) {
      const fileType = this.getFileType(file.mimetype);
      this.validateFileSize(file.size, fileType);
    }

    // Fayllarni storage'ga yuklash (transaction'dan tashqarida)
    const uploadedFiles: { file: Express.Multer.File; uploaded: UploadedFile; fileType: FileType }[] = [];

    try {
      for (const file of files || []) {
        const fileType = this.getFileType(file.mimetype);
        const folder = this.getFolderName(fileType);
        const uploaded = await this.storage.upload(file, folder);
        uploadedFiles.push({ file, uploaded, fileType });
      }

      // Message type aniqlash
      const messageType = this.determineMessageType(dto, files);

      // Transaction: message + files yaratish
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Message yaratish
        const message = await tx.message.create({
          data: {
            companyId: dto.companyId,
            globalDepartmentId: dto.globalDepartmentId,
            senderId: userId,
            content: dto.content || null,
            type: messageType,
            voiceDuration: dto.voiceDuration,
            replyToId: dto.replyToId,
            status: MessageStatus.SENT,
          },
        });

        // 2. File records yaratish
        if (uploadedFiles.length > 0) {
          await tx.file.createMany({
            data: uploadedFiles.map(({ uploaded, fileType }) => ({
              uploadedBy: userId,
              globalDepartmentId: dto.globalDepartmentId,
              messageId: message.id,
              originalName: uploaded.originalName,
              fileName: uploaded.fileName,
              fileSize: uploaded.size,
              mimeType: uploaded.mimeType,
              fileType,
              path: uploaded.path,
              isOutgoing: true,
            })),
          });
        }

        // 3. Full message olish
        return tx.message.findUnique({
          where: { id: message.id },
          include: {
            sender: {
              select: { id: true, username: true, name: true, avatar: true, systemRole: true },
            },
            replyTo: {
              select: REPLY_TO_SELECT,
            },
            files: true,
          },
        });
      });

      // Notification yuborish (transaction'dan keyin)
      if (this.messageProducer && result) {
        await this.messageProducer.sendNewMessage({
          messageId: result.id,
          companyId: dto.companyId,
          globalDepartmentId: dto.globalDepartmentId,
          senderId: userId,
          content: dto.content,
          type: result.type,
          replyToId: dto.replyToId as any,
          createdAt: result.createdAt,
          sender: {
            id: result.sender.id,
            username: result.sender.username,
            name: result.sender.name,
            avatar: result.sender.avatar || undefined,
          },
          files: result.files?.map((f) => ({
            id: f.id,
            originalName: f.originalName,
            fileType: f.fileType,
            url: this.storage!.getUrl(f.path),
          })),
        } as any);
      }

      return {
        ...result,
        files: result?.files?.map((f) => ({
          ...f,
          url: this.storage!.getUrl(f.path),
        })),
      };
    } catch (error) {
      // Rollback: yuklangan fayllarni o'chirish
      for (const { uploaded } of uploadedFiles) {
        try {
          await this.storage.delete(uploaded.path);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  private getFileType(mimeType: string): FileType {
    if (ALLOWED_MIME_TYPES.IMAGE.includes(mimeType)) return FileType.IMAGE;
    if (ALLOWED_MIME_TYPES.DOCUMENT.includes(mimeType)) return FileType.DOCUMENT;
    if (ALLOWED_MIME_TYPES.VOICE.includes(mimeType)) return FileType.VOICE;
    return FileType.OTHER;
  }

  private validateFileSize(size: number, fileType: FileType): void {
    const maxSize = FILE_SIZE_LIMITS[fileType];
    if (size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      throw new BadRequestException(`Fayl hajmi ${maxMB}MB dan oshmasligi kerak`);
    }
  }

  private getFolderName(fileType: FileType): string {
    switch (fileType) {
      case FileType.IMAGE: return 'images';
      case FileType.DOCUMENT: return 'documents';
      case FileType.VOICE: return 'voice';
      default: return 'other';
    }
  }

  private determineMessageType(
    dto: CreateMessageWithFilesDto,
    files: Express.Multer.File[],
  ): MessageType {
    if (!files?.length) return MessageType.TEXT;

    // Voice file mavjud bo'lsa
    if (dto.voiceDuration && files.some((f) => ALLOWED_MIME_TYPES.VOICE.includes(f.mimetype))) {
      return MessageType.VOICE;
    }

    // Fayllar mavjud bo'lsa FILE type
    return MessageType.FILE;
  }
}
