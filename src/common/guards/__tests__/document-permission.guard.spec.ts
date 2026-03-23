import { ExecutionContext, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { DocumentPermissionGuard } from '../document-permission.guard';
import { SystemRole, DocumentStatus } from '../../../../generated/prisma/client';
import { BANK_PAYMENT_DEPARTMENT_SLUG, LETTERS_DEPARTMENT_SLUG } from '../../constants';

describe('DocumentPermissionGuard', () => {
  let guard: DocumentPermissionGuard;
  let prisma: PrismaService;

  const mockPrismaService = {
    document: {
      findUnique: jest.fn(),
    },
    userCompanyMembership: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentPermissionGuard,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<DocumentPermissionGuard>(DocumentPermissionGuard);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  const createMockContext = (requestOptions: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestOptions,
      }),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should throw ForbiddenException if user not found', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if documentId not provided', async () => {
    const context = createMockContext({ user: { id: 'user-1' }, params: {} });
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException if document not found', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue(null);
    const context = createMockContext({ user: { id: 'user-1' }, params: { id: 'doc-1' } });
    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if document is not PENDING', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue({
      status: DocumentStatus.ACCEPTED,
      globalDepartment: { slug: 'test' }
    });
    const context = createMockContext({ user: { id: 'user-1' }, params: { id: 'doc-1' } });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for Bank Oplata', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue({
      status: DocumentStatus.PENDING,
      globalDepartment: { slug: BANK_PAYMENT_DEPARTMENT_SLUG }
    });
    const context = createMockContext({ user: { id: 'user-1' }, params: { id: 'doc-1' } });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should pass for FIN_* users', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue({
      status: DocumentStatus.PENDING,
      globalDepartment: { slug: 'test' }
    });
    const request = { user: { id: 'user-1', systemRole: SystemRole.FIN_ADMIN }, params: { id: 'doc-1' } };
    const context = createMockContext(request);
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect((request as any).document).toBeDefined();
  });

  it('should throw ForbiddenException if client user tries to reject in Xatlar department', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue({
      companyId: 'company-1',
      status: DocumentStatus.PENDING,
      globalDepartment: { slug: LETTERS_DEPARTMENT_SLUG }
    });
    mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue({
      isActive: true,
    });
    
    // Simulating a reject request by adding /reject to path
    const request = { 
      user: { id: 'user-1', systemRole: SystemRole.CLIENT_DIRECTOR }, 
      params: { id: 'doc-1' },
      route: { path: '/documents/:id/reject' }
    };
    const context = createMockContext(request);
    
    await expect(guard.canActivate(context)).rejects.toThrow(
      "Xatlar bo'limida hujjatlarni rad etish mumkin emas (faqat 'Tanishdim' tugmasi majvud)"
    );
  });

  it('should pass if client user tries to accept (Tanishdim) in Xatlar department', async () => {
    mockPrismaService.document.findUnique.mockResolvedValue({
      companyId: 'company-1',
      status: DocumentStatus.PENDING,
      globalDepartment: { slug: LETTERS_DEPARTMENT_SLUG }
    });
    mockPrismaService.userCompanyMembership.findUnique.mockResolvedValue({
      isActive: true,
    });
    
    const request = { 
      user: { id: 'user-1', systemRole: SystemRole.CLIENT_DIRECTOR }, 
      params: { id: 'doc-1' },
      route: { path: '/documents/:id/approve' }
    };
    const context = createMockContext(request);
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
