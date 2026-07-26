import { MediaDocument } from '../schemas/media.schema';

export interface IMediaRepository {
  create(data: Partial<MediaDocument>): Promise<MediaDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<MediaDocument | null>;
  findByEvent(eventId: string): Promise<MediaDocument[]>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
}

export const MEDIA_REPOSITORY = 'MEDIA_REPOSITORY';