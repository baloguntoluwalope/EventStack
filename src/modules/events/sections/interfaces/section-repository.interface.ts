import { SectionDocument } from '../schemas/section.schema';
import { CreateSectionDto } from '../dto/create-section.dto';

export const SECTION_REPOSITORY = 'SECTION_REPOSITORY';

export interface ISectionRepository {
  create(data: Record<string, any>): Promise<SectionDocument>;
  createMany?(sections: Record<string, any>[]): Promise<SectionDocument[]>;
  findByIdForTenant(id: string, organizationId: string): Promise<SectionDocument | null>;
  findByIdForTenantAndEvent(
    id: string,
    organizationId: string,
    eventId: string,
  ): Promise<SectionDocument | null>;
  findByEvent(eventId: string): Promise<SectionDocument[]>;
  updateById(id: string, dto: Partial<CreateSectionDto>): Promise<SectionDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
  reorder(eventId: string, orderedIds: string[]): Promise<void>;
}