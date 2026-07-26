import { NotFoundException } from '@nestjs/common';

export function assertFound<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new NotFoundException(message);
  return value;
}

export function assertDeleted(deleted: boolean, message: string): { deleted: true } {
  if (!deleted) throw new NotFoundException(message);
  return { deleted: true };
}