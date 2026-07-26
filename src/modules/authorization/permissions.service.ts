import { Injectable } from '@nestjs/common';
import { Role } from '../../common/constants/roles.constants';
import { Permission } from '../../common/constants/permissions.constants';
import { ROLE_PERMISSIONS } from './permissions.map';

@Injectable()
export class PermissionsService {
  hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }
}