import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { MessagesService } from '../messages.service';
import { PrismaService } from '../../../database/prisma.service';
import { Role } from '../../../../generated/prisma/client';
import { MessageType } from '../dto';

describe('MessagesService', () => {
  let service: MessagesService;

  const mockDepartment = {
    id: 'dept-id',
    companyId: 'company-id',
    name: 'General',
    isActive: true,
    company: { id: 'company-id', name: 'Test Company' },
  };

  const mockMessage = {
    id: 'msg-id',
    departmentId: 'dept-id',
    senderId: 'user-id',
    content: 'Hello',
    type: 'TEXT',
    isDeleted: false,
    isEdited: false,
    createdAt: new Date(),
    sender: {
      id: 'user-id',
      username: 'testuser',
      name: 'Test User',
      avatar: null,
      role: 'EMPLOYEE',
    },
    replyTo: null,
    files: [],
    documentApproval: null,
    _count: { edits: 0 },
  };

  const mockPrismaService = {
    department: {
      findUnique: jest.fn(),
    },
    departmentMember: {
      findUnique: jest.fn(),
    },
    message: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    messageEdit: {
      create: jest.fn(),
    },
    messageForward: {
      create: jest.fn(),
    },
    documentApproval: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a text message', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        department: mockDepartment,
      });

      const result = await service.create(
        'dept-id',
        { content: 'Hello', type: MessageType.TEXT },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.content).toBe('Hello');
      expect(mockPrismaService.message.create).toHaveBeenCalled();
    });

    it('should allow ADMIN to send message to any department', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        department: mockDepartment,
      });

      await service.create(
        'dept-id',
        { content: 'Hello from admin' },
        'admin-id',
        Role.ADMIN,
      );

      // Should not check membership for ADMIN
      expect(mockPrismaService.departmentMember.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not a member', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create('dept-id', { content: 'Hello' }, 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for voice without duration', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });

      await expect(
        service.create(
          'dept-id',
          { type: MessageType.VOICE },
          'user-id',
          Role.EMPLOYEE,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create document approval for DOCUMENT type', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });
      mockPrismaService.message.create.mockResolvedValue({
        ...mockMessage,
        type: 'DOCUMENT',
      });
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        type: 'DOCUMENT',
        department: mockDepartment,
      });
      mockPrismaService.documentApproval.create.mockResolvedValue({});

      await service.create(
        'dept-id',
        {
          type: MessageType.DOCUMENT,
          documentName: 'Contract',
          documentNumber: 'DOC-001',
        },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(mockPrismaService.documentApproval.create).toHaveBeenCalledWith({
        data: {
          messageId: mockMessage.id,
          documentName: 'Contract',
          documentNumber: 'DOC-001',
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated messages', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });
      mockPrismaService.message.findMany.mockResolvedValue([mockMessage]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll('dept-id', 'user-id', Role.EMPLOYEE);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should include deleted messages for ADMIN', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.message.findMany.mockResolvedValue([]);
      mockPrismaService.message.count.mockResolvedValue(0);

      await service.findAll('dept-id', 'admin-id', Role.ADMIN);

      // Should not filter by isDeleted for ADMIN
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { departmentId: 'dept-id' },
        }),
      );
    });
  });

  describe('update', () => {
    it('should update message and save edit history', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        department: mockDepartment,
      });
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });
      mockPrismaService.messageEdit.create.mockResolvedValue({});
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        content: 'Updated',
        isEdited: true,
      });

      await service.update('msg-id', { content: 'Updated' }, 'user-id', Role.EMPLOYEE);

      expect(mockPrismaService.messageEdit.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-id',
          content: 'Hello',
        },
      });
    });

    it('should throw ForbiddenException if not message owner', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        senderId: 'other-user',
      });

      await expect(
        service.update('msg-id', { content: 'Updated' }, 'user-id', Role.EMPLOYEE),
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

      const result = await service.remove('msg-id', 'user-id', Role.EMPLOYEE);

      expect(result.message).toBe('Message deleted successfully');
      expect(mockPrismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-id' },
        data: expect.objectContaining({
          isDeleted: true,
          deletedBy: 'user-id',
        }),
      });
    });
  });

  describe('forward', () => {
    it('should forward message to another department', async () => {
      const targetDept = { ...mockDepartment, id: 'target-dept-id' };

      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        department: mockDepartment,
      });
      mockPrismaService.department.findUnique
        .mockResolvedValueOnce(mockDepartment) // source
        .mockResolvedValueOnce(targetDept) // target
        .mockResolvedValueOnce(targetDept); // for access check
      mockPrismaService.departmentMember.findUnique.mockResolvedValue({ id: 'dm-id' });
      mockPrismaService.messageForward.create.mockResolvedValue({});
      mockPrismaService.message.create.mockResolvedValue({
        ...mockMessage,
        id: 'new-msg-id',
        departmentId: 'target-dept-id',
      });

      await service.forward(
        'msg-id',
        { toDepartmentId: 'target-dept-id' },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(mockPrismaService.messageForward.create).toHaveBeenCalled();
      expect(mockPrismaService.message.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for cross-company forward', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        department: mockDepartment,
      });
      mockPrismaService.department.findUnique
        .mockResolvedValueOnce(mockDepartment)
        .mockResolvedValueOnce({
          ...mockDepartment,
          id: 'other-dept',
          companyId: 'other-company', // Different company
        });

      await expect(
        service.forward(
          'msg-id',
          { toDepartmentId: 'other-dept' },
          'user-id',
          Role.ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getEditHistory', () => {
    it('should return edit history for ADMIN', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessage,
        edits: [{ id: 'edit-1', content: 'Old content', editedAt: new Date() }],
      });

      const result = await service.getEditHistory('msg-id', 'admin-id', Role.ADMIN);

      expect(result.currentContent).toBe('Hello');
      expect(result.editHistory).toHaveLength(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.getEditHistory('msg-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDeletedMessages', () => {
    it('should return deleted messages for ADMIN', async () => {
      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.message.findMany.mockResolvedValue([
        { ...mockMessage, isDeleted: true },
      ]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.getDeletedMessages(
        'dept-id',
        'admin-id',
        Role.ADMIN,
      );

      expect(result.data).toHaveLength(1);
    });

    it('should throw ForbiddenException for non-admin', async () => {
      await expect(
        service.getDeletedMessages('dept-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
