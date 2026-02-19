import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyRole } from '../../../generated/prisma/client';
import { COMPANY_ROLES_KEY } from '../decorators/company-roles.decorator';
import { PrismaService } from '../../database/prisma.service';

/**
 * Guard for client company users (CLIENT_FOUNDER, CLIENT_DIRECTOR, CLIENT_EMPLOYEE)
 * Checks user's membership role for the specified company
 *
 * Requires companyId in request (params, body, or query)
 * 1FIN system users (with systemRole) bypass this guard
 */
@Injectable()
export class CompanyRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<CompanyRole[]>(
      COMPANY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException('Foydalanuvchi topilmadi');
    }

    // 1FIN system users bypass company role check
    if (user.systemRole) {
      return true;
    }

    // Get companyId from request
    const companyId = this.extractCompanyId(request);

    if (!companyId) {
      throw new BadRequestException('Kompaniya ID talab qilinadi');
    }

    // Check user's membership in this company
    const membership = await this.prisma.userCompanyMembership.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId,
        },
      },
    });

    if (!membership || !membership.isActive) {
      throw new ForbiddenException('Siz bu kompaniyaga kirish huquqiga ega emassiz');
    }

    // Check if user's companyRole is in required roles
    const hasRole = requiredRoles.includes(membership.companyRole);

    if (!hasRole) {
      throw new ForbiddenException('Sizda ushbu amalni bajarish huquqi yo\'q');
    }

    // Attach membership to request for later use
    request.membership = membership;

    return true;
  }

  private extractCompanyId(request: any): string | null {
    // Try params first (e.g., /companies/:companyId/...)
    if (request.params?.companyId) {
      return request.params.companyId;
    }

    // Try body
    if (request.body?.companyId) {
      return request.body.companyId;
    }

    // Try query
    if (request.query?.companyId) {
      return request.query.companyId;
    }

    return null;
  }
}
