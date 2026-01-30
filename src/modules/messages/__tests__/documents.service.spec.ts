import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '../../../database/prisma.service';
import { Role, DocumentStatus } from '../../../../generated/prisma/client';

describe('DocumentsService', () => {
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
      department: {
        id: 'dept-id',
        companyId: 'company-id',
      },
      sender: {
        id: 'sender-id',
        username: 'sender',
        name: 'Sender',
      },
    },
  };

  const mockPrismaService = {
    documentApproval: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    userCompany: {
      findFirst: jest.fn(),
    },
    operatorCompany: {
      findFirst: jest.fn(),
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

  describe('approve', () => {
    it('should approve a pending document', async () => {
      mockPrismaService.documentApproval.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.userCompany.findFirst.mockResolvedValue({ id: 'uc-id' });
      mockPrismaService.documentApproval.update.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.APPROVED,
        approvedBy: 'user-id',
        approvedAt: new Date(),
        approver: { id: 'user-id', username: 'approver', name: 'Approver' },
      });

      const result = await service.approve('doc-id', 'user-id', Role.DIRECTOR);

      expect(result.status).toBe(DocumentStatus.APPROVED);
      expect(mockPrismaService.documentApproval.update).toHaveBeenCalledWith({
        where: { id: 'doc-id' },
        data: expect.objectContaining({
          status: DocumentStatus.APPROVED,
          approvedBy: 'user-id',
        }),
        include: expect.any(Object),
      });
    });

    it('should allow ADMIN to approve', async () => {
      mockPrismaService.documentApproval.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.documentApproval.update.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.APPROVED,
      });

      await service.approve('doc-id', 'admin-id', Role.ADMIN);

      expect(mockPrismaService.userCompany.findFirst).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if already processed', async () => {
      mockPrismaService.documentApproval.findUnique.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.APPROVED,
      });

      await expect(
        service.approve('doc-id', 'user-id', Role.DIRECTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for OPERATOR', async () => {
      mockPrismaService.documentApproval.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.operatorCompany.findFirst.mockResolvedValue({ id: 'oc-id' });

      await expect(
        service.approve('doc-id', 'operator-id', Role.OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject', () => {
    it('should reject a pending document with reason', async () => {
      mockPrismaService.documentApproval.findUnique.mockResolvedValue(mockDocument);
      mockPrismaService.userCompany.findFirst.mockResolvedValue({ id: 'uc-id' });
      mockPrismaService.documentApproval.update.mockResolvedValue({
        ...mockDocument,
        status: DocumentStatus.REJECTED,
        rejectionReason: 'Invalid document',
        approvedBy: 'user-id',
      });

      const result = await service.reject(
        'doc-id',
        { reason: 'Invalid document' },
        'user-id',
        Role.DIRECTOR,
      );

      expect(result.status).toBe(DocumentStatus.REJECTED);
      expect(mockPrismaService.documentApproval.update).toHaveBeenCalledWith({
        where: { id: 'doc-id' },
        data: expect.objectContaining({
          status: DocumentStatus.REJECTED,
          rejectionReason: 'Invalid document',
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('getPending', () => {
    it('should return pending documents for company', async () => {
      mockPrismaService.userCompany.findFirst.mockResolvedValue({ id: 'uc-id' });
      mockPrismaService.documentApproval.findMany.mockResolvedValue([mockDocument]);

      const result = await service.getPending('company-id', 'user-id', Role.DIRECTOR);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.documentApproval.findMany).toHaveBeenCalledWith({
        where: {
          status: DocumentStatus.PENDING,
          message: {
            department: {
              companyId: 'company-id',
            },
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw ForbiddenException if no company access', async () => {
      mockPrismaService.userCompany.findFirst.mockResolvedValue(null);
      mockPrismaService.operatorCompany.findFirst.mockResolvedValue(null);

      await expect(
        service.getPending('company-id', 'user-id', Role.EMPLOYEE),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAll', () => {
    it('should return paginated documents', async () => {
      mockPrismaService.userCompany.findFirst.mockResolvedValue({ id: 'uc-id' });
      mockPrismaService.documentApproval.findMany.mockResolvedValue([mockDocument]);
      mockPrismaService.documentApproval.count.mockResolvedValue(1);

      const result = await service.getAll('company-id', 'user-id', Role.DIRECTOR);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.userCompany.findFirst.mockResolvedValue({ id: 'uc-id' });
      mockPrismaService.documentApproval.findMany.mockResolvedValue([]);
      mockPrismaService.documentApproval.count.mockResolvedValue(0);

      await service.getAll(
        'company-id',
        'user-id',
        Role.DIRECTOR,
        DocumentStatus.APPROVED,
      );

      expect(mockPrismaService.documentApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: DocumentStatus.APPROVED,
          }),
        }),
      );
    });
  });
});
