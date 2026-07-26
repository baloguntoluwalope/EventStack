import { Role } from '../../common/constants/roles.constants';
import { Permission } from '../../common/constants/permissions.constants';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: Object.values(Permission),
  [Role.ADMIN]: [
    Permission.EVENT_CREATE, Permission.EVENT_EDIT, Permission.EVENT_PUBLISH, Permission.EVENT_DELETE,
    Permission.ORGANIZATION_MANAGE, Permission.MEMBER_INVITE, Permission.MEMBER_REMOVE,
  ],
  [Role.EDITOR]: [Permission.EVENT_CREATE, Permission.EVENT_EDIT, Permission.EVENT_PUBLISH],
  [Role.VIEWER]: [],
  [Role.VOLUNTEER]: [],
};