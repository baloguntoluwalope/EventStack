import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'audited';

export interface AuditMetadata {
  entity: string;
  action: string;
  /** Optional — extracts only the fields worth diffing from the
   * before/after objects, so we store {score: {before,after}}, not an
   * entire document snapshot per event. */
  diffFields?: string[];
}

export const Audited = (
  entity: string,
  action: string,
  diffFields?: string[],
) => SetMetadata(AUDITED_KEY, { entity, action, diffFields } as AuditMetadata);