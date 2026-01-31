import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateMessageDto,
  UpdateMessageDto,
  ForwardMessageDto,
  MessageType,
} from './dto';
import { Role, DocumentStatus } from '../../../generated/prisma/client';
import { MessageProducer } from '../../queues/producers';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private messageProducer?: MessageProducer,
  ) {}

  private async checkDepartmentAccess(
    departmentId: string,
    userId: string,
    userRole: Role,
  ): Promise<{ department: any; companyId: string }> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { company: true },
    });

    if (!department || !department.isActive) {
      throw new NotFoundException('Department not found');
    }

    // SUPER_ADMIN va ADMIN barcha departmentlarga kirishi mumkin
    if (userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN) {
      return { department, companyId: department.companyId };
    }

    // Boshqa rollar uchun membership tekshirish
    const isMember = await this.prisma.departmentMember.findUnique({
      where: {
        userId_departmentId: { userId, departmentId },
      },
    });

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this department');
    }

    return { department, companyId: department.companyId };
  }

  async create(
    departmentId: string,
    dto: CreateMessageDto,
    userId: string,
    userRole: Role,
  ) {
    await this.checkDepartmentAccess(departmentId, userId, userRole);

    // Validation
    if (dto.type === MessageType.VOICE && !dto.voiceDuration) {
      throw new BadRequestException('Voice duration is required for voice messages');
    }

    if (dto.type === MessageType.DOCUMENT) {
      if (!dto.documentName || !dto.documentNumber) {
        throw new BadRequestException(
          'Document name and number are required for document messages',
        );
      }
    }

    if (dto.replyToId) {
      const replyToMessage = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, departmentId, isDeleted: false },
      });
      if (!replyToMessage) {
        throw new NotFoundException('Reply message not found');
      }
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        departmentId,
        senderId: userId,
        content: dto.content,
        type: dto.type || 'TEXT',
        voiceDuration: dto.voiceDuration,
        replyToId: dto.replyToId,
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatar: true, role: true },
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

    // Create DocumentApproval if type is DOCUMENT
    if (dto.type === MessageType.DOCUMENT) {
      await this.prisma.documentApproval.create({
        data: {
          messageId: message.id,
          documentName: dto.documentName!,
          documentNumber: dto.documentNumber!,
        },
      });
    }

    // RabbitMQ ga yuborish
    if (this.messageProducer) {
      await this.messageProducer.sendNewMessage({
        messageId: message.id,
        departmentId,
        senderId: userId,
        content: dto.content,
        type: dto.type || 'TEXT',
        replyToId: dto.replyToId,
        createdAt: message.createdAt,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
          name: message.sender.name,
          avatar: message.sender.avatar || undefined,
        },
      });
    }

    return this.findOne(message.id, userId, userRole);
  }

  async findAll(
    departmentId: string,
    userId: string,
    userRole: Role,
    page = 1,
    limit = 50,
  ) {
    await this.checkDepartmentAccess(departmentId, userId, userRole);

    const skip = (page - 1) * limit;

    // ADMIN ko'rish: o'chirilganlarni ham ko'radi
    const whereDeleted =
      userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN
        ? {}
        : { isDeleted: false };

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { departmentId, ...whereDeleted },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true, role: true },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              sender: { select: { id: true, name: true } },
            },
          },
          files: {
            select: {
              id: true,
              originalName: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              path: true,
            },
          },
          documentApproval: {
            select: {
              id: true,
              documentName: true,
              documentNumber: true,
              status: true,
              rejectionReason: true,
              approvedBy: true,
              approvedAt: true,
            },
          },
          _count: { select: { edits: true } },
        },
      }),
      this.prisma.message.count({ where: { departmentId, ...whereDeleted } }),
    ]);

    return {
      data: messages.map((msg) => this.formatMessage(msg, userId, userRole)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(messageId: string, userId: string, userRole: Role) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        department: true,
        sender: {
          select: { id: true, username: true, name: true, avatar: true, role: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: { select: { id: true, name: true } },
          },
        },
        files: {
          select: {
            id: true,
            originalName: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            path: true,
          },
        },
        documentApproval: {
          select: {
            id: true,
            documentName: true,
            documentNumber: true,
            status: true,
            rejectionReason: true,
            approvedBy: true,
            approvedAt: true,
          },
        },
        _count: { select: { edits: true } },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check access
    await this.checkDepartmentAccess(message.departmentId, userId, userRole);

    return this.formatMessage(message, userId, userRole);
  }

  async update(
    messageId: string,
    dto: UpdateMessageDto,
    userId: string,
    userRole: Role,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Cannot edit deleted message');
    }

    if (message.type !== 'TEXT') {
      throw new ForbiddenException('Only text messages can be edited');
    }

    // Save old content to edit history
    await this.prisma.messageEdit.create({
      data: {
        messageId,
        content: message.content || '',
      },
    });

    // Update message
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
    });

    // RabbitMQ ga yuborish
    if (this.messageProducer) {
      await this.messageProducer.sendEditedMessage({
        messageId,
        departmentId: message.departmentId,
        content: dto.content,
        editedAt: new Date(),
      });
    }

    return this.findOne(messageId, userId, userRole);
  }

  async remove(messageId: string, userId: string, userRole: Role) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const deletedAt = new Date();

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt,
        deletedBy: userId,
      },
    });

    // RabbitMQ ga yuborish
    if (this.messageProducer) {
      await this.messageProducer.sendDeletedMessage({
        messageId,
        departmentId: message.departmentId,
        deletedBy: userId,
        deletedAt,
      });
    }

    return { message: 'Message deleted successfully' };
  }

  async forward(
    messageId: string,
    dto: ForwardMessageDto,
    userId: string,
    userRole: Role,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { department: true },
    });

    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    // Check source department access
    await this.checkDepartmentAccess(message.departmentId, userId, userRole);

    // Check target department exists and in same company
    const targetDept = await this.prisma.department.findUnique({
      where: { id: dto.toDepartmentId },
    });

    if (!targetDept || !targetDept.isActive) {
      throw new NotFoundException('Target department not found');
    }

    if (targetDept.companyId !== message.department.companyId) {
      throw new ForbiddenException('Can only forward within same company');
    }

    // Check target department access
    await this.checkDepartmentAccess(dto.toDepartmentId, userId, userRole);

    // Create forward record
    await this.prisma.messageForward.create({
      data: {
        messageId,
        fromDepartmentId: message.departmentId,
        toDepartmentId: dto.toDepartmentId,
        forwardedBy: userId,
        note: dto.note,
      },
    });

    // Create new message in target department
    const forwardedMessage = await this.prisma.message.create({
      data: {
        departmentId: dto.toDepartmentId,
        senderId: userId,
        content: message.content,
        type: message.type,
        voiceDuration: message.voiceDuration,
        parentId: messageId, // reference to original
      },
    });

    return this.findOne(forwardedMessage.id, userId, userRole);
  }

  async getEditHistory(messageId: string, userId: string, userRole: Role) {
    // Only ADMIN can see edit history
    if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view edit history');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        edits: {
          orderBy: { editedAt: 'desc' },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return {
      currentContent: message.content,
      editHistory: message.edits,
    };
  }

  async getDeletedMessages(
    departmentId: string,
    userId: string,
    userRole: Role,
    page = 1,
    limit = 50,
  ) {
    // Only ADMIN can see deleted messages
    if (userRole !== Role.SUPER_ADMIN && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can view deleted messages');
    }

    await this.checkDepartmentAccess(departmentId, userId, userRole);

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { departmentId, isDeleted: true },
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      this.prisma.message.count({ where: { departmentId, isDeleted: true } }),
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

  private formatMessage(message: any, userId: string, userRole: Role) {
    const isAdmin = userRole === Role.SUPER_ADMIN || userRole === Role.ADMIN;

    // Hide deleted message content for non-admins
    if (message.isDeleted && !isAdmin) {
      return {
        ...message,
        content: null,
        isDeleted: true,
      };
    }

    return message;
  }
}
