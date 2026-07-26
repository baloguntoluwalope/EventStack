import { Module, Global } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { OrganizationPolicy } from './policies/organization.policy';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Global()
@Module({
  providers: [PermissionsService, OrganizationPolicy, PermissionsGuard],
  exports: [PermissionsService, OrganizationPolicy, PermissionsGuard],
})
export class AuthorizationModule {}