import { SectionDocument } from '../schemas/section.schema';

export interface ISectionRepository {
  create(data: Partial<SectionDocument>): Promise<SectionDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<SectionDocument | null>;
  findByEvent(eventId: string): Promise<SectionDocument[]>;
  updateById(id: string, data: Partial<SectionDocument>): Promise<SectionDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
  reorder(eventId: string, orderedIds: string[]): Promise<void>;
}

export const SECTION_REPOSITORY = 'SECTION_REPOSITORY';