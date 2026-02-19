import { Test, TestingModule } from '@nestjs/testing';
import { MessageType, SystemRole } from '../../../../generated/prisma/client';
import { MessagesController } from '../messages.controller';
import { MessagesService } from '../messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;

  const mockMessage = {
    id: 'msg-1',
    companyId: 'company-1',
    globalDepartmentId: 'dept-1',
    senderId: 'user-1',
    content: 'Hello',
    type: MessageType.TEXT,
    createdAt: new Date(),
  };

  const mockMessagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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
      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        content: 'Hello',
      };

      const result = await controller.create(dto, 'user-1', SystemRole.FIN_ADMIN);

      expect(result).toEqual(mockMessage);
      expect(service.create).toHaveBeenCalledWith('user-1', SystemRole.FIN_ADMIN, dto);
    });
  });

  describe('findAll', () => {
    it('should return messages', async () => {
      mockMessagesService.findAll.mockResolvedValue({ data: [mockMessage], meta: {} });

      const result = await controller.findAll('company-1', 'dept-1', '1', '50', 'user-1', SystemRole.FIN_ADMIN);

      expect(result.data).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith('company-1', 'dept-1', 'user-1', SystemRole.FIN_ADMIN, 1, 50);
    });
  });

  describe('update', () => {
    it('should update a message', async () => {
      mockMessagesService.update.mockResolvedValue({ ...mockMessage, content: 'Updated' });

      const result = await controller.update('msg-1', { content: 'Updated' }, 'user-1', SystemRole.FIN_ADMIN);

      expect(result.content).toBe('Updated');
      expect(service.update).toHaveBeenCalledWith('msg-1', { content: 'Updated' }, 'user-1', SystemRole.FIN_ADMIN);
    });
  });

  describe('remove', () => {
    it('should delete a message', async () => {
      mockMessagesService.remove.mockResolvedValue({ message: 'Xabar o\'chirildi' });

      const result = await controller.remove('msg-1', 'user-1', SystemRole.FIN_ADMIN);

      expect(result.message).toBeDefined();
      expect(service.remove).toHaveBeenCalledWith('msg-1', 'user-1', SystemRole.FIN_ADMIN);
    });
  });
});
