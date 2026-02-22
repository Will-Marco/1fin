import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Optional,
} from '@nestjs/common';
import { MessageStatus, SystemRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MessageProducer } from '../../queues/producers';
import {
    CreateMessageDto,
    ForwardMessageDto,
    UpdateMessageDto,
} from './dto';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private messageProducer?: MessageProducer,
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

  async create(userId: string, userSystemRole: SystemRole | null, dto: CreateMessageDto) {
    if (!dto.companyId || !dto.globalDepartmentId) {
      throw new BadRequestException('companyId va globalDepartmentId majburiy');
    }

    await this.checkAccess(dto.companyId, dto.globalDepartmentId, userId, userSystemRole);

    // Reply validation
    if (dto.replyToId) {
      const replyToMessage = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, companyId: dto.companyId, isDeleted: false },
      });
      if (!replyToMessage) {
        throw new NotFoundException('Reply qilinayotgan xabar topilmadi');
      }
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        companyId: dto.companyId,
        globalDepartmentId: dto.globalDepartmentId,
        senderId: userId,
        content: dto.content,
        type: (dto.type as any) || 'TEXT',
        voiceDuration: dto.voiceDuration,
        replyToId: dto.replyToId,
        status: MessageStatus.SENT,
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatar: true, systemRole: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Notify via WebSocket/RabbitMQ
    if (this.messageProducer) {
      await this.messageProducer.sendNewMessage({
        messageId: message.id,
        // @ts-ignore - Update MessagePayload interface later or ignore if it's transient
        companyId: dto.companyId,
        globalDepartmentId: dto.globalDepartmentId,
        senderId: userId,
        content: dto.content,
        type: message.type,
        replyToId: dto.replyToId as any,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          name: message.sender.name,
          avatar: message.sender.avatar || undefined,
        },
      });
    }

    return message;
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
            select: {
              id: true,
              content: true,
              sender: { select: { id: true, name: true } },
            },
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
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, name: true } },
          },
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
}
