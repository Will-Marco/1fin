import {
  ForbiddenException
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
});
