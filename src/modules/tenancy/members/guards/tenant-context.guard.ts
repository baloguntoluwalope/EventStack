import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MembersService } from '../members.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private membersService: MembersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.params.orgId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context missing');
    }

    const membership = await this.membersService.findByOrgAndUser(organizationId, request.user.userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    request.membership = membership;
    return true;
  }
}