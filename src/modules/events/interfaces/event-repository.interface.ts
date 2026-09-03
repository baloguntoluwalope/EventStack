import { ClientSession } from 'mongoose';
import { EventDocument } from '../schemas/event.schema';

export interface IEventRepository {
  create(
    data: Partial<EventDocument>,
    session?: ClientSession,
  ): Promise<EventDocument>;

  findBySlug(
    slug: string,
  ): Promise<EventDocument | null>;

  findById(
    id: string,
  ): Promise<EventDocument | null>;

  findAllPublished(): Promise<EventDocument[]>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<EventDocument | null>;

  findManyForTenant(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
    },
  ): Promise<EventDocument[]>;

  updateById(
    id: string,
    data: Partial<EventDocument>,
  ): Promise<EventDocument | null>;

  deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean>;

  count(
    filter?: Record<string, any>,
  ): Promise<number>;

  withTransaction<T>(
    fn: (
      session: ClientSession,
    ) => Promise<T>,
  ): Promise<T>;
}

export const EVENT_REPOSITORY =
  'EVENT_REPOSITORY';