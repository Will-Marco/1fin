import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Guard for department access
 * Checks if:
 * 1. Department is enabled for the company (CompanyDepartmentConfig)
 * 2. User has access to the department (MembershipDepartmentAccess)
 *
 * 1FIN system users (with systemRole) bypass this guard
 *
 * Requires departmentId (or globalDepartmentId) and companyId in request
 */
@Injectable()
export class DepartmentAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    // 1FIN system users bypass department access check
    if (user.systemRole) {
      return true;
    }

    // Get departmentId and companyId from request
    const departmentId = this.extractDepartmentId(request);
    const companyId = this.extractCompanyId(request);

    if (!departmentId) {
      throw new BadRequestException("Bo'lim ID talab qilinadi");
    }

    if (!companyId) {
      throw new BadRequestException('Kompaniya ID talab qilinadi');
    }

    // Check if department exists
    const department = await this.prisma.globalDepartment.findUnique({
      where: { id: departmentId },
    });

    if (!department || !department.isActive) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    // Check if department is enabled for this company
    const companyConfig = await this.prisma.companyDepartmentConfig.findUnique({
      where: {
        companyId_globalDepartmentId: {
          companyId,
          globalDepartmentId: departmentId,
        },
      },
    });

    if (!companyConfig || !companyConfig.isEnabled) {
      throw new ForbiddenException("Bu bo'lim kompaniya uchun yoqilmagan");
    }

    // Get user's membership for this company
    const membership = await this.prisma.userCompanyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
      include: {
        allowedDepartments: true,
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Siz bu kompaniyaga kirish huquqiga ega emassiz');
    }

    // Check if user has access to this department
    const hasDepartmentAccess = membership.allowedDepartments.some(
      (access) => access.globalDepartmentId === departmentId,
    );

    if (!hasDepartmentAccess) {
      throw new ForbiddenException("Sizda bu bo'limga kirish huquqi yo'q");
    }

    // Attach department and membership to request for later use
    request.department = department;
    request.membership = membership;

    return true;
  }

  private extractDepartmentId(request: any): string | null {
    // Try various field names
    return (
      request.params?.departmentId ||
      request.params?.globalDepartmentId ||
      request.body?.departmentId ||
      request.body?.globalDepartmentId ||
      request.query?.departmentId ||
      request.query?.globalDepartmentId ||
      null
    );
  }

  private extractCompanyId(request: any): string | null {
    // Already attached by CompanyRoleGuard or from request
    if (request.membership?.companyId) {
      return request.membership.companyId;
    }

    return (
      request.params?.companyId ||
      request.body?.companyId ||
      request.query?.companyId ||
      null
    );
  }
}
