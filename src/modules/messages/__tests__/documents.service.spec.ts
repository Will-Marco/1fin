import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentStatus } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DocumentsService } from '../documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockDocument = {
    id: 'doc-1',
    documentName: 'Test Doc',
    documentNumber: '123',
    companyId: 'company-1',
    globalDepartmentId: 'dept-1',
    status: DocumentStatus.PENDING,
    createdById: 'user-1',
    expiresAt: new Date(),
    createdAt: new Date(),
  };

  const mockPrismaService = {
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentActionLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a document and log the action', async () => {
      mockPrismaService.document.create.mockResolvedValue(mockDocument);
      mockPrismaService.documentActionLog.create.mockResolvedValue({});

      const dto = {
        companyId: 'company-1',
        globalDepartmentId: 'dept-1',
        documentName: 'Test Doc',
        documentNumber: '123',
      };

      const result = await service.create('user-1', dto);

      expect(result).toEqual(mockDocument);
      expect(mockPrismaService.document.create).toHaveBeenCalled();
      expect(mockPrismaService.documentActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'CREATED' }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending document', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.ACCEPTED,
      });

      const result = await service.approve('doc-1', 'admin-1');

      expect(result.status).toBe(DocumentStatus.ACCEPTED);
      expect(mockPrismaService.documentActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ACCEPTED' }),
        }),
      );
    });

    it('should throw BadRequestException if document is not pending', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.ACCEPTED,
      });

      await expect(service.approve('doc-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending document with a reason', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.document.update.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.REJECTED,
      });

      const result = await service.reject('doc-1', 'admin-1', {
        reason: 'Invalid signature',
      });

      expect(result.status).toBe(DocumentStatus.REJECTED);
      expect(mockPrismaService.documentActionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REJECTED',
            details: { reason: 'Invalid signature' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a document if found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(mockDocument);

      const result = await service.findOne('doc-1');

      expect(result).toEqual(mockDocument);
    });

    it('should throw NotFoundException if document not found', async () => {
      mockPrismaService.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
