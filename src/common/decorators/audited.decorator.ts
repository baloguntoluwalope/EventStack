import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'audited';

export interface AuditMetadata {
  entity: string;
  action: string;
}

export const Audited = (entity: string, action: string) =>
  SetMetadata(AUDITED_KEY, { entity, action } as AuditMetadata);