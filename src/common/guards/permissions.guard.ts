import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../../modules/authorization/permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private permissionsService: PermissionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const membership = request.membership;
    if (!membership || !this.permissionsService.hasPermission(membership.role, permission)) {
      throw new ForbiddenException('Insufficient permissions for this action');
    }
    return true;
  }
}