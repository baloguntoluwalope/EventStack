import { PageDocument } from '../schemas/page.schema';

export const PAGE_REPOSITORY =
  'PAGE_REPOSITORY';

export interface IPageRepository {
  create(
    data: Partial<PageDocument>,
  ): Promise<PageDocument>;

  findByEventForTenant(
    eventId: string,
    organizationId: string,
  ): Promise<PageDocument[]>;

  /**
   * Find the Home page for an event.
   *
   * organizationId is optional because public page
   * resolution does not have tenant context.
   *
   * Internal callers should ALWAYS provide it.
   */
  findHomeForEvent(
    eventId: string,
    organizationId?: string,
  ): Promise<PageDocument | null>;

  findBySlugForEvent(
    eventId: string,
    slug: string,
  ): Promise<PageDocument | null>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<PageDocument | null>;

  findByIdForTenantAndEvent(
    id: string,
    organizationId: string,
    eventId: string,
  ): Promise<PageDocument | null>;

  updateById(
    id: string,
    data: Partial<PageDocument>,
  ): Promise<PageDocument | null>;

  deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean>;
}