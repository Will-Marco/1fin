import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MessageStatus, MessageType, SystemRole } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MessageProducer } from '../../../queues/producers';
import { MessagesService } from '../messages.service';

describe('MessagesService', () => {
  let service: MessagesService;

  const mockMessage = {
    id: 'msg-1',
    companyId: 'company-1',
    globalDepartmentId: 'dept-1',
    senderId: 'user-1',
    content: 'Hello',
    type: MessageType.TEXT,
    status: MessageStatus.SENT,
    createdAt: new Date(),
    sender: { id: 'user-1', name: 'User 1' },
    replyTo: null,
  };

  const mockPrismaService = {
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    userCompanyMembership: {
      findFirst: jest.fn(),
    },
    messageEdit: {
      create: jest.fn(),
    },
    messageForward: {
      create: jest.fn(),
    },
    companyDepartmentConfig: {
      findUnique: jest.fn(),
    },
    file: {
      createMany: jest.fn(),
    },
  };

  const mockMessageProducer = {
    sendNewMessage: jest.fn(),
    sendEditedMessage: jest.fn(),
    sendDeletedMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MessageProducer, useValue: mockMessageProducer },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a message for a 1FIN staff user', async () => {
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      const result = await service.create('user-1', SystemRole.FIN_ADMIN, dto);

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalled();
      expect(mockMessageProducer.sendNewMessage).toHaveBeenCalled();
    });

    it('should create a message for a client user with valid membership', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      const result = await service.create('user-1', null, dto);

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.userCompanyMembership.findFirst).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if client user has no membership', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue(null);

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      await expect(service.create('user-1', null, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return messages for staff', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([mockMessage]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', globalDepartmentId: 'dept-1' },
        }),
      );
    });
  });

  describe('update', () => {
    it('should update message content if sender', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({ id: 'mem-1' });
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        content: 'Updated',
        isEdited: true,
      });

      const result = await service.update('msg-1', { content: 'Updated' }, 'user-1', null);

      expect(mockPrismaService.message.update).toHaveBeenCalled();
      expect(mockPrismaService.messageEdit.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not sender', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        service.update('msg-1', { content: 'Updated' }, 'user-other', null),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete message', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      const result = await service.remove('msg-1', 'user-1', null);

      expect(result.message).toBeDefined();
      expect(mockPrismaService.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDeleted: true }),
        }),
      );
    });
  });

  describe('forwardMessage', () => {
    const forwardDto = {
      toDepartmentId: 'dept-2',
      companyId: 'company-1',
      note: 'Muhim xabar',
    };

    const mockOriginalMessage = {
      id: 'msg-1',
      companyId: 'company-1',
      globalDepartmentId: 'dept-1',
      senderId: 'user-1',
      content: 'Original message',
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      sender: { id: 'user-1', name: 'User A', username: 'usera' },
      files: [
        {
          id: 'file-1',
          originalName: 'doc.pdf',
          fileName: 'uuid.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileType: 'DOCUMENT',
          path: '/uploads/uuid.pdf',
        },
      ],
      globalDepartment: { id: 'dept-1', name: 'Department A', slug: 'dept-a' },
      forwardedAsNew: [],
    };

    const mockForwardedMessage = {
      id: 'msg-2',
      companyId: 'company-1',
      globalDepartmentId: 'dept-2',
      senderId: 'user-2',
      content: 'Original message',
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      sender: { id: 'user-2', name: 'User B', username: 'userb' },
      globalDepartment: { id: 'dept-2', name: 'Department B', slug: 'dept-b' },
    };

    it('should successfully forward message (FIN_EMPLOYEE)', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockOriginalMessage);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        isEnabled: true,
      });
      mockPrismaService.message.create.mockResolvedValue(mockForwardedMessage);
      mockPrismaService.messageForward.create.mockResolvedValue({});
      mockPrismaService.file.createMany.mockResolvedValue({});

      const result = await service.forwardMessage(
        'msg-1',
        forwardDto,
        'user-2',
        SystemRole.FIN_EMPLOYEE,
      );

      expect(result.id).toBe('msg-2');
      expect(result.forwardedFrom.originalSender.name).toBe('User A');
      expect(mockPrismaService.message.create).toHaveBeenCalled();
      expect(mockPrismaService.messageForward.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            forwardedMessageId: 'msg-2',
            originalMessageId: 'msg-1',
            forwardedBy: 'user-2',
          }),
        }),
      );
    });

    it('should throw ForbiddenException if user is CLIENT_*', async () => {
      await expect(
        service.forwardMessage('msg-1', forwardDto, 'user-1', SystemRole.CLIENT_EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forward chain - show root original sender', async () => {
      // Mock: msg-1 was already forwarded from msg-0
      const chainedMessage = {
        ...mockOriginalMessage,
        forwardedAsNew: [
          {
            originalMessage: {
              id: 'msg-0',
              senderId: 'user-0',
              sender: { id: 'user-0', name: 'Root User', username: 'root' },
            },
          },
        ],
      };

      mockPrismaService.message.findUnique.mockResolvedValue(chainedMessage);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        isEnabled: true,
      });
      mockPrismaService.message.create.mockResolvedValue(mockForwardedMessage);
      mockPrismaService.messageForward.create.mockResolvedValue({});
      mockPrismaService.file.createMany.mockResolvedValue({});

      const result = await service.forwardMessage(
        'msg-1',
        forwardDto,
        'user-2',
        SystemRole.FIN_ADMIN,
      );

      // Root original sender should be shown
      expect(result.forwardedFrom.originalSender.name).toBe('Root User');
      expect(mockPrismaService.messageForward.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalMessageId: 'msg-0', // Root message, not msg-1
          }),
        }),
      );
    });

    it('should throw NotFoundException if message not found', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(null);

      await expect(
        service.forwardMessage('invalid-id', forwardDto, 'user-2', SystemRole.FIN_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if different company', async () => {
      const differentCompanyMessage = {
        ...mockOriginalMessage,
        companyId: 'company-999', // Different company
      };

      mockPrismaService.message.findUnique.mockResolvedValue(differentCompanyMessage);

      await expect(
        service.forwardMessage('msg-1', forwardDto, 'user-2', SystemRole.FIN_DIRECTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if target department not enabled', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockOriginalMessage);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(null); // Department not enabled

      await expect(
        service.forwardMessage('msg-1', forwardDto, 'user-2', SystemRole.FIN_EMPLOYEE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if department exists but disabled', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(mockOriginalMessage);
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        isEnabled: false, // Disabled
      });

      await expect(
        service.forwardMessage('msg-1', forwardDto, 'user-2', SystemRole.FIN_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
