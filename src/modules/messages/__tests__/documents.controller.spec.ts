import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from '../documents.controller';
import { DocumentsService } from '../documents.service';
import { Role, DocumentStatus } from '../../../../generated/prisma/client';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: DocumentsService;

  const mockDocument = {
    id: 'doc-id',
    messageId: 'msg-id',
    documentName: 'Contract',
    documentNumber: 'DOC-001',
    status: DocumentStatus.PENDING,
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
    message: {
      id: 'msg-id',
      sender: { id: 'sender-id', username: 'sender', name: 'Sender' },
    },
  };

  const mockDocumentsService = {
    approve: jest.fn(),
    reject: jest.fn(),
    getPending: jest.fn(),
    getAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: mockDocumentsService },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
  });

  describe('approve', () => {
    it('should approve a document', async () => {
      const approvedDoc = {
        ...mockDocument,
        status: DocumentStatus.APPROVED,
        approvedBy: 'user-id',
        approvedAt: new Date(),
      };
      mockDocumentsService.approve.mockResolvedValue(approvedDoc);

      const result = await controller.approve('doc-id', 'user-id', Role.DIRECTOR);

      expect(result.status).toBe(DocumentStatus.APPROVED);
      expect(service.approve).toHaveBeenCalledWith('doc-id', 'user-id', Role.DIRECTOR);
    });
  });

  describe('reject', () => {
    it('should reject a document with reason', async () => {
      const rejectedDoc = {
        ...mockDocument,
        status: DocumentStatus.REJECTED,
        rejectionReason: 'Invalid document',
        approvedBy: 'user-id',
      };
      mockDocumentsService.reject.mockResolvedValue(rejectedDoc);

      const result = await controller.reject(
        'doc-id',
        { reason: 'Invalid document' },
        'user-id',
        Role.DIRECTOR,
      );

      expect(result.status).toBe(DocumentStatus.REJECTED);
      expect(result.rejectionReason).toBe('Invalid document');
      expect(service.reject).toHaveBeenCalledWith(
        'doc-id',
        { reason: 'Invalid document' },
        'user-id',
        Role.DIRECTOR,
      );
    });
  });

  describe('getPending', () => {
    it('should return pending documents', async () => {
      mockDocumentsService.getPending.mockResolvedValue([mockDocument]);

      const result = await controller.getPending('company-id', 'user-id', Role.DIRECTOR);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(DocumentStatus.PENDING);
      expect(service.getPending).toHaveBeenCalledWith(
        'company-id',
        'user-id',
        Role.DIRECTOR,
      );
    });
  });

  describe('getAll', () => {
    it('should return paginated documents', async () => {
      const mockResult = {
        data: [mockDocument],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockDocumentsService.getAll.mockResolvedValue(mockResult);

      const result = await controller.getAll(
        'company-id',
        undefined,
        '1',
        '20',
        'user-id',
        Role.DIRECTOR,
      );

      expect(result.data).toHaveLength(1);
      expect(service.getAll).toHaveBeenCalledWith(
        'company-id',
        'user-id',
        Role.DIRECTOR,
        undefined,
        1,
        20,
      );
    });

    it('should filter by status', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockDocumentsService.getAll.mockResolvedValue(mockResult);

      await controller.getAll(
        'company-id',
        DocumentStatus.APPROVED,
        '1',
        '20',
        'user-id',
        Role.DIRECTOR,
      );

      expect(service.getAll).toHaveBeenCalledWith(
        'company-id',
        'user-id',
        Role.DIRECTOR,
        DocumentStatus.APPROVED,
        1,
        20,
      );
    });
  });
});
