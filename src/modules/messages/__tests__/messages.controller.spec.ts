import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from '../messages.controller';
import { MessagesService } from '../messages.service';
import { Role } from '../../../../generated/prisma/client';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;

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
  };

  const mockMessagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    forward: jest.fn(),
    getEditHistory: jest.fn(),
    getDeletedMessages: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: mockMessagesService },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a message', async () => {
      mockMessagesService.create.mockResolvedValue(mockMessage);

      const result = await controller.create(
        'dept-id',
        { content: 'Hello', type: 'TEXT' as any },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result).toEqual(mockMessage);
      expect(service.create).toHaveBeenCalledWith(
        'dept-id',
        { content: 'Hello', type: 'TEXT' },
        'user-id',
        Role.EMPLOYEE,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated messages', async () => {
      const mockResult = {
        data: [mockMessage],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      mockMessagesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(
        'dept-id',
        '1',
        '50',
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.data).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith(
        'dept-id',
        'user-id',
        Role.EMPLOYEE,
        1,
        50,
      );
    });
  });

  describe('findOne', () => {
    it('should return a message', async () => {
      mockMessagesService.findOne.mockResolvedValue(mockMessage);

      const result = await controller.findOne('msg-id', 'user-id', Role.EMPLOYEE);

      expect(result).toEqual(mockMessage);
      expect(service.findOne).toHaveBeenCalledWith('msg-id', 'user-id', Role.EMPLOYEE);
    });
  });

  describe('update', () => {
    it('should update a message', async () => {
      const updatedMessage = { ...mockMessage, content: 'Updated', isEdited: true };
      mockMessagesService.update.mockResolvedValue(updatedMessage);

      const result = await controller.update(
        'msg-id',
        { content: 'Updated' },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.content).toBe('Updated');
      expect(result.isEdited).toBe(true);
      expect(service.update).toHaveBeenCalledWith(
        'msg-id',
        { content: 'Updated' },
        'user-id',
        Role.EMPLOYEE,
      );
    });
  });

  describe('remove', () => {
    it('should delete a message', async () => {
      mockMessagesService.remove.mockResolvedValue({
        message: 'Message deleted successfully',
      });

      const result = await controller.remove('msg-id', 'user-id', Role.EMPLOYEE);

      expect(result.message).toBe('Message deleted successfully');
      expect(service.remove).toHaveBeenCalledWith('msg-id', 'user-id', Role.EMPLOYEE);
    });
  });

  describe('forward', () => {
    it('should forward a message', async () => {
      const forwardedMessage = { ...mockMessage, departmentId: 'target-dept' };
      mockMessagesService.forward.mockResolvedValue(forwardedMessage);

      const result = await controller.forward(
        'msg-id',
        { toDepartmentId: 'target-dept' },
        'user-id',
        Role.EMPLOYEE,
      );

      expect(result.departmentId).toBe('target-dept');
      expect(service.forward).toHaveBeenCalledWith(
        'msg-id',
        { toDepartmentId: 'target-dept' },
        'user-id',
        Role.EMPLOYEE,
      );
    });
  });

  describe('getEditHistory', () => {
    it('should return edit history for admin', async () => {
      const mockHistory = {
        currentContent: 'Current',
        editHistory: [{ id: 'edit-1', content: 'Old', editedAt: new Date() }],
      };
      mockMessagesService.getEditHistory.mockResolvedValue(mockHistory);

      const result = await controller.getEditHistory('msg-id', 'admin-id', Role.ADMIN);

      expect(result.editHistory).toHaveLength(1);
      expect(service.getEditHistory).toHaveBeenCalledWith('msg-id', 'admin-id', Role.ADMIN);
    });
  });

  describe('getDeletedMessages', () => {
    it('should return deleted messages for admin', async () => {
      const mockResult = {
        data: [{ ...mockMessage, isDeleted: true }],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      mockMessagesService.getDeletedMessages.mockResolvedValue(mockResult);

      const result = await controller.getDeletedMessages(
        'dept-id',
        '1',
        '50',
        'admin-id',
        Role.ADMIN,
      );

      expect(result.data).toHaveLength(1);
      expect(service.getDeletedMessages).toHaveBeenCalledWith(
        'dept-id',
        'admin-id',
        Role.ADMIN,
        1,
        50,
      );
    });
  });
});
