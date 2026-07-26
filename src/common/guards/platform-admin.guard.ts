import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Gates platform-catalog actions (Template/Theme creation) that have no
 * owning organization, so RolesGuard/PermissionsGuard (both org-scoped)
 * don't apply. Must run after JwtAuthGuard, which populates request.user.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.platformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }
    return true;
  }
}