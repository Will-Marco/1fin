import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '../../../generated/prisma/client';
import { SYSTEM_ROLES_KEY } from '../decorators/system-roles.decorator';

/**
 * Guard for 1FIN system users (FIN_DIRECTOR, FIN_ADMIN, FIN_EMPLOYEE)
 * Checks user.systemRole against required roles
 */
@Injectable()
export class SystemRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      SYSTEM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // User must have a systemRole (1FIN employee)
    if (!user?.systemRole) {
      throw new ForbiddenException(
        'Bu amal faqat 1FIN xodimlari uchun ruxsat etilgan',
      );
    }

    // Check if user's systemRole is in required roles
    const hasRole = requiredRoles.includes(user.systemRole);

    if (!hasRole) {
      throw new ForbiddenException('Sizda ushbu amalni bajarish huquqi yo\'q');
    }

    return true;
  }
}
