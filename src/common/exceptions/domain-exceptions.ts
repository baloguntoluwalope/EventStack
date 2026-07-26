import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';

export class TenantAccessDeniedException extends ForbiddenException {
  constructor(resource = 'resource') {
    super(`You do not have access to this ${resource} in this organization`);
  }
}

export class ResourceNotFoundException extends NotFoundException {
  constructor(resource: string) {
    super(`${resource} not found`);
  }
}

export class DuplicateResourceException extends ConflictException {
  constructor(resource: string, field: string) {
    super(`${resource} with this ${field} already exists`);
  }
}