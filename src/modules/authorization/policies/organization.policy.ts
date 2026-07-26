import { Injectable } from '@nestjs/common';
import { BasePolicy } from '../../../common/policies/base-policy';
import { MembershipDocument } from '../../tenancy/members/schemas/membership.schema';
import { PermissionsService } from '../permissions.service';
import { Permission } from '../../../common/constants/permissions.constants';

@Injectable()
export class OrganizationPolicy extends BasePolicy<MembershipDocument, void> {
  constructor(private permissionsService: PermissionsService) {
    super();
  }

  canManage(membership: MembershipDocument): boolean {
    return this.permissionsService.hasPermission(membership.role, Permission.ORGANIZATION_MANAGE);
  }
}