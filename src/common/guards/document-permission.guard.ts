import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CompanyRole, DocumentStatus } from '../../../generated/prisma/client';
import { BANK_PAYMENT_DEPARTMENT_SLUG } from '../constants';

/**
 * Guard for document operations (accept/reject)
 *
 * Rules from SRS:
 * - CLIENT_FOUNDER cannot accept/reject (monitoring only)
 * - CLIENT_DIRECTOR and CLIENT_EMPLOYEE can accept/reject
 * - Bank Oplata department has no accept/reject
 * - Document must be in PENDING status
 *
 * 1FIN system users can accept/reject
 */
@Injectable()
export class DocumentPermissionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    // Get documentId from request
    const documentId = this.extractDocumentId(request);

    if (!documentId) {
      throw new BadRequestException('Hujjat ID talab qilinadi');
    }

    // Get the document
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        globalDepartment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Hujjat topilmadi');
    }

    // Check if document is in PENDING status
    if (document.status !== DocumentStatus.PENDING) {
      throw new ForbiddenException('Bu hujjat allaqachon ko\'rib chiqilgan');
    }

    // Check Bank Oplata special rule - no accept/reject
    if (document.globalDepartment.slug === BANK_PAYMENT_DEPARTMENT_SLUG) {
      throw new ForbiddenException(
        "Bank to'lovlari bo'limida tasdiqlash/rad etish mavjud emas",
      );
    }

    // 1FIN system users can accept/reject
    if (user.systemRole) {
      request.document = document;
      return true;
    }

    // Get user's membership for document's company
    const membership = await this.prisma.userCompanyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: document.companyId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Siz bu kompaniyaga kirish huquqiga ega emassiz');
    }

    // CLIENT_FOUNDER cannot accept/reject (monitoring only)
    if (membership.companyRole === CompanyRole.CLIENT_FOUNDER) {
      throw new ForbiddenException(
        'Asoschilarda hujjatlarni tasdiqlash/rad etish huquqi yo\'q',
      );
    }

    // CLIENT_DIRECTOR and CLIENT_EMPLOYEE can accept/reject
    if (
      membership.companyRole !== CompanyRole.CLIENT_DIRECTOR &&
      membership.companyRole !== CompanyRole.CLIENT_EMPLOYEE
    ) {
      throw new ForbiddenException('Sizda ushbu amalni bajarish huquqi yo\'q');
    }

    // Attach document and membership to request for later use
    request.document = document;
    request.membership = membership;

    return true;
  }

  private extractDocumentId(request: any): string | null {
    return (
      request.params?.documentId ||
      request.params?.id ||
      request.body?.documentId ||
      request.query?.documentId ||
      null
    );
  }
}
