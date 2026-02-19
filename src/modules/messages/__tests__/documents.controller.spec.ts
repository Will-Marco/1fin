import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus } from '../../../../generated/prisma/client';
import { DocumentsController } from '../documents.controller';
import { DocumentsService } from '../documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: DocumentsService;

  const mockDocument = {
    id: 'doc-1',
    documentName: 'Test Doc',
    documentNumber: '123',
    companyId: 'company-1',
    globalDepartmentId: 'dept-1',
    status: DocumentStatus.PENDING,
    createdById: 'user-1',
  };

  const mockDocumentsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
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

  describe('create', () => {
    it('should create a document', async () => {
      mockDocumentsService.create.mockResolvedValue(mockDocument);
      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        documentName: 'Test Doc',
        documentNumber: '123',
      };

      const result = await controller.create(dto, 'user-1');

      expect(result).toEqual(mockDocument);
      expect(service.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      mockDocumentsService.findAll.mockResolvedValue({ data: [mockDocument], meta: {} });

      const result = await controller.findAll('company-1', 'dept-1', undefined, undefined, '1', '20');

      expect(result.data).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalledWith(1, 20, {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        status: undefined,
        search: undefined,
      });
    });
  });

  describe('approve', () => {
    it('should approve a document', async () => {
      mockDocumentsService.approve.mockResolvedValue({ ...mockDocument, status: DocumentStatus.ACCEPTED });

      const result = await controller.approve('doc-1', 'admin-1');

      expect(result.status).toBe(DocumentStatus.ACCEPTED);
      expect(service.approve).toHaveBeenCalledWith('doc-1', 'admin-1');
    });
  });

  describe('reject', () => {
    it('should reject a document', async () => {
      mockDocumentsService.reject.mockResolvedValue({ ...mockDocument, status: DocumentStatus.REJECTED });

      const result = await controller.reject('doc-1', { reason: 'Invalid' }, 'admin-1');

      expect(result.status).toBe(DocumentStatus.REJECTED);
      expect(service.reject).toHaveBeenCalledWith('doc-1', 'admin-1', { reason: 'Invalid' });
    });
  });
});
