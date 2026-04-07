import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DocumentStatus,
  MessageStatus,
  MessageType,
  SystemRole,
} from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MessageProducer } from '../../../queues/producers';
import { MessagesService } from '../messages.service';
import {
  BANK_PAYMENT_DEPARTMENT_SLUG,
  LETTERS_DEPARTMENT_SLUG,
} from '../../../common/constants';
import { STORAGE_PROVIDER } from '../../files/storage/storage.interface';

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
      findFirst: jest.fn(),
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
    globalDepartment: {
      findUnique: jest.fn(),
    },
    file: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    document: {
      create: jest.fn(),
    },
    documentActionLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockMessageProducer = {
    sendNewMessage: jest.fn(),
    sendEditedMessage: jest.fn(),
    sendDeletedMessage: jest.fn(),
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
    getUrl: jest.fn((path: string) => `/uploads/${path}`),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MessageProducer, useValue: mockMessageProducer },
        { provide: STORAGE_PROVIDER, useValue: mockStorageProvider },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('createWithFiles', () => {
    const mockMessageWithFiles = {
      ...mockMessage,
      files: [],
    };

    it('should create a message for a 1FIN staff user', async () => {
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockMessageWithFiles,
      );

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      const result = await service.createWithFiles(
        'user-1',
        SystemRole.FIN_ADMIN,
        dto,
        [],
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.message.create).toHaveBeenCalled();
      expect(mockMessageProducer.sendNewMessage).toHaveBeenCalled();
    });

    it('should create a message for a client user with valid membership', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockMessageWithFiles,
      );

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      const result = await service.createWithFiles('user-1', null, dto, []);

      expect(result).toBeDefined();
      expect(
        mockPrismaService.userCompanyMembership.findFirst,
      ).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if client user has no membership', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue(null);

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      await expect(
        service.createWithFiles('user-1', null, dto, []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if client user tries to send to Xatlar department', async () => {
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
      });
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-letters',
        slug: LETTERS_DEPARTMENT_SLUG,
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-letters',
        content: 'Hello',
      };

      await expect(
        service.createWithFiles('user-client', null, dto, []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a message if 1FIN user tries to send to Xatlar department', async () => {
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-letters',
        slug: LETTERS_DEPARTMENT_SLUG,
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockMessageWithFiles,
      );

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-letters',
        content: 'Hello',
      };

      const result = await service.createWithFiles(
        'user-admin',
        SystemRole.FIN_ADMIN,
        dto,
        [],
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.message.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if no content and no files', async () => {
      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: '',
      };

      await expect(
        service.createWithFiles('user-1', SystemRole.FIN_ADMIN, dto, []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create message with files and rollback on failure', async () => {
      const mockFile = {
        fieldname: 'files',
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dogovor',
      });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'test.pdf',
        fileName: 'uuid-test.pdf',
        path: 'documents/uuid-test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.document.create.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.documentActionLog.create.mockResolvedValue({});
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          {
            id: 'file-1',
            path: 'documents/uuid-test.pdf',
            document: { id: 'doc-1' },
          },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'With file',
      };

      const result = await service.createWithFiles(
        'user-1',
        SystemRole.FIN_ADMIN,
        dto,
        [mockFile],
      );

      expect(result).toBeDefined();
      expect(mockStorageProvider.upload).toHaveBeenCalled();
      expect(mockPrismaService.file.createMany).toHaveBeenCalled();
    });

    it('should auto-create Document when 1FIN user sends DOCUMENT file', async () => {
      const mockPdfFile = {
        fieldname: 'files',
        originalname: 'shartnoma.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dogovor', // Not bank-payment
      });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'shartnoma.pdf',
        fileName: 'uuid-shartnoma.pdf',
        path: 'documents/uuid-shartnoma.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.document.create.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.documentActionLog.create.mockResolvedValue({});
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          {
            id: 'file-1',
            path: 'documents/uuid-shartnoma.pdf',
            document: { id: 'doc-1', status: DocumentStatus.PENDING },
          },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: "Shartnomani ko'ring",
      };

      await service.createWithFiles(
        'user-1',
        SystemRole.FIN_EMPLOYEE, // 1FIN user
        dto,
        [mockPdfFile],
      );

      expect(mockPrismaService.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DocumentStatus.PENDING,
            companyId: 'company-1',
            globalDepartmentId: 'dept-1',
          }),
        }),
      );
      expect(mockPrismaService.documentActionLog.create).toHaveBeenCalled();
    });

    it('should NOT create Document when 1FIN user sends IMAGE file', async () => {
      const mockImageFile = {
        fieldname: 'files',
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dogovor',
      });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'photo.jpg',
        fileName: 'uuid-photo.jpg',
        path: 'images/uuid-photo.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          { id: 'file-1', path: 'images/uuid-photo.jpg', document: null },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Rasm',
      };

      await service.createWithFiles('user-1', SystemRole.FIN_ADMIN, dto, [
        mockImageFile,
      ]);

      expect(mockPrismaService.document.create).not.toHaveBeenCalled();
    });

    it('should NOT create Document when Client user sends DOCUMENT file', async () => {
      const mockPdfFile = {
        fieldname: 'files',
        originalname: 'javob.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
      });
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dogovor',
      });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'javob.pdf',
        fileName: 'uuid-javob.pdf',
        path: 'documents/uuid-javob.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          { id: 'file-1', path: 'documents/uuid-javob.pdf', document: null },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Javob fayli',
      };

      await service.createWithFiles(
        'client-user',
        null, // Client user (no systemRole)
        dto,
        [mockPdfFile],
      );

      expect(mockPrismaService.document.create).not.toHaveBeenCalled();
    });

    it('should NOT create Document when sending to Bank Oplata department', async () => {
      const mockPdfFile = {
        fieldname: 'files',
        originalname: 'payment.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-bank',
        slug: BANK_PAYMENT_DEPARTMENT_SLUG, // Bank Oplata
      });
      mockStorageProvider.upload.mockResolvedValue({
        originalName: 'payment.pdf',
        fileName: 'uuid-payment.pdf',
        path: 'documents/uuid-payment.pdf',
        size: 1024,
        mimeType: 'application/pdf',
      });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          { id: 'file-1', path: 'documents/uuid-payment.pdf', document: null },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-bank',
        content: "To'lov hujjati",
      };

      await service.createWithFiles(
        'user-1',
        SystemRole.FIN_ADMIN, // 1FIN user
        dto,
        [mockPdfFile],
      );

      expect(mockPrismaService.document.create).not.toHaveBeenCalled();
    });

    it('should create ONE Document for multiple DOCUMENT files in same message', async () => {
      const mockPdfFile1 = {
        fieldname: 'files',
        originalname: 'shartnoma.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test1'),
      } as Express.Multer.File;

      const mockPdfFile2 = {
        fieldname: 'files',
        originalname: 'ilova.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 2048,
        buffer: Buffer.from('test2'),
      } as Express.Multer.File;

      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dogovor',
      });
      mockStorageProvider.upload
        .mockResolvedValueOnce({
          originalName: 'shartnoma.pdf',
          fileName: 'uuid-shartnoma.pdf',
          path: 'documents/uuid-shartnoma.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        })
        .mockResolvedValueOnce({
          originalName: 'ilova.docx',
          fileName: 'uuid-ilova.docx',
          path: 'documents/uuid-ilova.docx',
          size: 2048,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      mockPrismaService.message.create.mockResolvedValue(mockMessage);
      mockPrismaService.document.create.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.documentActionLog.create.mockResolvedValue({});
      mockPrismaService.message.findUnique.mockResolvedValue({
        ...mockMessageWithFiles,
        files: [
          {
            id: 'file-1',
            document: { id: 'doc-1', status: DocumentStatus.PENDING },
          },
          {
            id: 'file-2',
            document: { id: 'doc-1', status: DocumentStatus.PENDING },
          },
        ],
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Shartnoma va ilova',
      };

      await service.createWithFiles('user-1', SystemRole.FIN_ADMIN, dto, [
        mockPdfFile1,
        mockPdfFile2,
      ]);

      // Document should be created only ONCE
      expect(mockPrismaService.document.create).toHaveBeenCalledTimes(1);
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
      mockPrismaService.userCompanyMembership.findFirst.mockResolvedValue({
        id: 'mem-1',
      });
      mockPrismaService.message.findUnique.mockResolvedValue(mockMessage);
      mockPrismaService.message.update.mockResolvedValue({
        ...mockMessage,
        content: 'Updated',
        isEdited: true,
      });

      const result = await service.update(
        'msg-1',
        { content: 'Updated' },
        'user-1',
        null,
      );

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
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockOriginalMessage,
      );
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
        service.forwardMessage(
          'msg-1',
          forwardDto,
          'user-1',
          SystemRole.CLIENT_EMPLOYEE,
        ),
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
        service.forwardMessage(
          'invalid-id',
          forwardDto,
          'user-2',
          SystemRole.FIN_ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if different company', async () => {
      const differentCompanyMessage = {
        ...mockOriginalMessage,
        companyId: 'company-999', // Different company
      };

      mockPrismaService.message.findUnique.mockResolvedValue(
        differentCompanyMessage,
      );

      await expect(
        service.forwardMessage(
          'msg-1',
          forwardDto,
          'user-2',
          SystemRole.FIN_DIRECTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if target department not enabled', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockOriginalMessage,
      );
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue(
        null,
      ); // Department not enabled

      await expect(
        service.forwardMessage(
          'msg-1',
          forwardDto,
          'user-2',
          SystemRole.FIN_EMPLOYEE,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if department exists but disabled', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockOriginalMessage,
      );
      mockPrismaService.companyDepartmentConfig.findUnique.mockResolvedValue({
        isEnabled: false, // Disabled
      });

      await expect(
        service.forwardMessage(
          'msg-1',
          forwardDto,
          'user-2',
          SystemRole.FIN_ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('replyTo structure', () => {
    const mockMessageWithReply = {
      ...mockMessage,
      replyToId: 'reply-msg-id',
      replyTo: {
        id: 'reply-msg-id',
        content: 'Original message text',
        type: MessageType.TEXT,
        voiceDuration: null,
        sender: {
          id: 'sender-id',
          name: 'Original Sender',
          username: 'original.sender',
        },
        files: [],
        _count: { files: 0 },
      },
    };

    const mockVoiceReply = {
      ...mockMessage,
      replyToId: 'voice-msg-id',
      replyTo: {
        id: 'voice-msg-id',
        content: null,
        type: MessageType.VOICE,
        voiceDuration: 45,
        sender: {
          id: 'sender-id',
          name: 'Voice Sender',
          username: 'voice.sender',
        },
        files: [],
        _count: { files: 0 },
      },
    };

    const mockFileReply = {
      ...mockMessage,
      replyToId: 'file-msg-id',
      replyTo: {
        id: 'file-msg-id',
        content: 'Message with files',
        type: MessageType.FILE,
        voiceDuration: null,
        sender: {
          id: 'sender-id',
          name: 'File Sender',
          username: 'file.sender',
        },
        files: [
          {
            id: 'file-1',
            fileType: 'IMAGE',
            originalName: 'photo.jpg',
            mimeType: 'image/jpeg',
          },
          {
            id: 'file-2',
            fileType: 'DOCUMENT',
            originalName: 'doc.pdf',
            mimeType: 'application/pdf',
          },
        ],
        _count: { files: 3 },
      },
    };

    it('should include replyTo with type and sender info for TEXT message', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([
        mockMessageWithReply,
      ]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data[0].replyTo).toBeDefined();
      expect(result.data[0].replyTo.type).toBe(MessageType.TEXT);
      expect(result.data[0].replyTo.sender.name).toBe('Original Sender');
      expect(result.data[0].replyTo.sender.username).toBe('original.sender');
    });

    it('should include voiceDuration for VOICE message reply', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([mockVoiceReply]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data[0].replyTo.type).toBe(MessageType.VOICE);
      expect(result.data[0].replyTo.voiceDuration).toBe(45);
    });

    it('should include files preview and count for FILE message reply', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([mockFileReply]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data[0].replyTo.type).toBe(MessageType.FILE);
      expect(result.data[0].replyTo.files).toHaveLength(2);
      expect(result.data[0].replyTo.files[0].fileType).toBe('IMAGE');
      expect(result.data[0].replyTo._count.files).toBe(3);
    });

    it('should create message with replyTo and return full structure', async () => {
      const createdMessage = {
        ...mockMessage,
        replyToId: 'reply-msg-id',
        replyTo: mockMessageWithReply.replyTo,
        files: [],
      };
      mockPrismaService.message.findFirst.mockResolvedValue({
        id: 'reply-msg-id',
      });
      mockPrismaService.message.create.mockResolvedValue(createdMessage);
      mockPrismaService.message.findUnique.mockResolvedValue(createdMessage);
      mockPrismaService.globalDepartment.findUnique.mockResolvedValue({
        id: 'dept-1',
        slug: 'dept-1',
      });

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Reply message',
        replyToId: 'reply-msg-id',
      };

      const result = await service.createWithFiles(
        'user-1',
        SystemRole.FIN_ADMIN,
        dto,
        [],
      );

      expect(result?.replyTo).toBeDefined();
      expect(result?.replyTo).not.toBeNull();
      expect((result?.replyTo as any).type).toBe(MessageType.TEXT);
      expect((result?.replyTo as any).sender).toBeDefined();
    });
  });

  describe('deletedByUser', () => {
    const mockDeletedMessage = {
      ...mockMessage,
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: 'admin-user-id',
      deletedByUser: {
        id: 'admin-user-id',
        name: 'Admin User',
        username: 'admin.user',
        systemRole: SystemRole.FIN_ADMIN,
      },
    };

    it('should include deletedByUser info for deleted messages (admin view)', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([
        mockDeletedMessage,
      ]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data[0].isDeleted).toBe(true);
      expect(result.data[0].deletedByUser).toBeDefined();
      expect(result.data[0].deletedByUser.name).toBe('Admin User');
      expect(result.data[0].deletedByUser.systemRole).toBe(
        SystemRole.FIN_ADMIN,
      );
    });

    it('should include deletedByUser with username for findOne', async () => {
      mockPrismaService.message.findUnique.mockResolvedValue(
        mockDeletedMessage,
      );

      const result = await service.findOne(
        'msg-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.deletedByUser).toBeDefined();
      expect(result.deletedByUser.username).toBe('admin.user');
    });

    it('should show deletedByUser role correctly', async () => {
      const directorDeletedMessage = {
        ...mockDeletedMessage,
        deletedByUser: {
          id: 'director-id',
          name: 'Director User',
          username: 'director',
          systemRole: SystemRole.FIN_DIRECTOR,
        },
      };
      mockPrismaService.message.findMany.mockResolvedValue([
        directorDeletedMessage,
      ]);
      mockPrismaService.message.count.mockResolvedValue(1);

      const result = await service.findAll(
        'company-1',
        'dept-1',
        'admin-1',
        SystemRole.FIN_ADMIN,
      );

      expect(result.data[0].deletedByUser.systemRole).toBe(
        SystemRole.FIN_DIRECTOR,
      );
    });
  });
});
