import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '../../../generated/prisma/client';
import { SYSTEM_ROLES_KEY } from '../decorators/system-roles.decorator';
import { PrismaService } from '../../database/prisma.service';

/**
 * Guard for checking user's SystemRole (FIN_* or CLIENT_*)
 * For CLIENT_* roles, also checks membership in the specified company
 *
 * Requires companyId in request (params, body, or query) for CLIENT_* roles
 * FIN_* roles bypass company membership check
 */
@Injectable()
export class CompanyRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      SYSTEM_ROLES_KEY,
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

    // Check if user's systemRole is in required roles
    const hasRole = requiredRoles.includes(user.systemRole);

    if (!hasRole) {
      throw new ForbiddenException('Sizda ushbu amalni bajarish huquqi yo\'q');
    }

    // If CLIENT_* role, verify company membership
    const isClientRole = [
      SystemRole.CLIENT_FOUNDER,
      SystemRole.CLIENT_DIRECTOR,
      SystemRole.CLIENT_EMPLOYEE,
    ].includes(user.systemRole);

    if (isClientRole) {
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
        throw new ForbiddenException(
          'Siz bu kompaniyaga kirish huquqiga ega emassiz',
        );
      }

      // Attach membership to request for later use
      request.membership = membership;
    }

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
