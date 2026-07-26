import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constants';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);