import { EventDocument } from '../schemas/event.schema';

export interface IEventRepository {
  create(data: Partial<EventDocument>): Promise<EventDocument>;
  findBySlug(slug: string): Promise<EventDocument | null>;
  findAllPublished(): Promise<EventDocument[]>;
  findByIdForTenant(id: string, organizationId: string): Promise<EventDocument | null>;
  findManyForTenant(
    organizationId: string,
    options?: { page?: number; limit?: number },
  ): Promise<EventDocument[]>;
  updateById(id: string, data: Partial<EventDocument>): Promise<EventDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
  count(filter?: Record<string, any>): Promise<number>;
}

export const EVENT_REPOSITORY = 'EVENT_REPOSITORY';