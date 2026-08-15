import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import type { ISectionRepository } from './interfaces/section-repository.interface';
import { SECTION_REPOSITORY } from './interfaces/section-repository.interface';

import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { EventsService } from '../events.service';
import { SectionDocument } from './schemas/section.schema';

export interface BatchSectionPayload {
  organizationId: string;
  eventId: string;
  type: string;
  content: Record<string, unknown>;
  order?: number;
  visible?: boolean;
}

@Injectable()
export class SectionsService {
  private readonly logger = new Logger(SectionsService.name);

  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepo: ISectionRepository,
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Helper to ensure valid Mongo ObjectIds before querying the database.
   */
  private toValidId(id: string, label: string): string {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label} ID format: ${id}`);
    }
    return id;
  }

  /**
   * Creates a single section for a tenant event.
   */
  async create(
    organizationId: string,
    eventId: string,
    dto: CreateSectionDto,
  ): Promise<SectionDocument> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');

    // 1. Verify parent event ownership
    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);

    // 2. Persist section with guaranteed default payload structure
    return this.sectionRepo.create({
      ...dto,
      organizationId: validOrgId as any,
      eventId: validEventId as any,
      content: dto.content ?? {},
      order: dto.order ?? 0,
      visible: dto.visible ?? true,
    });
  }

  /**
   * Bulk inserts sections during template/event initialization to prevent deadlocks.
   */
  async createMany(sections: BatchSectionPayload[]): Promise<SectionDocument[]> {
    if (!sections || sections.length === 0) {
      return [];
    }

    // Use optimized batch insertion if supported by underlying repository
    if (this.sectionRepo.createMany) {
      return this.sectionRepo.createMany(sections);
    }

    // Fallback parallel insertion
    return Promise.all(
      sections.map((sec) =>
        this.sectionRepo.create({
          type: sec.type as any,
          content: sec.content ?? {},
          organizationId: sec.organizationId as any,
          eventId: sec.eventId as any,
          order: sec.order ?? 0,
          visible: sec.visible ?? true,
        }),
      ),
    );
  }

  /**
   * Retrieves all sections for a specific event ordered for rendering.
   */
  async listForEvent(
    organizationId: string,
    eventId: string,
  ): Promise<SectionDocument[]> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');

    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);
    return this.sectionRepo.findByEvent(validEventId);
  }

  /**
   * Fetches a single section by ID, ensuring correct scope and full field hydration.
   */
  async findOne(
    organizationId: string,
    eventId: string,
    id: string,
  ): Promise<SectionDocument> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');
    const validSectionId = this.toValidId(id, 'section');

    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);

    const section = await this.sectionRepo.findByIdForTenantAndEvent(
      validSectionId,
      validOrgId,
      validEventId,
    );

    if (!section) {
      throw new NotFoundException(`Section with ID ${validSectionId} not found`);
    }

    return section;
  }

  /**
   * Updates section properties and deep merges `content` objects to prevent 
   * partial updates from stripping existing fields.
   */
  async update(
    organizationId: string,
    eventId: string,
    id: string,
    dto: Partial<CreateSectionDto> | UpdateSectionDto,
  ): Promise<SectionDocument> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');
    const validSectionId = this.toValidId(id, 'section');

    // 1. Verify parent event belongs to organization
    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);

    // 2. Locate existing document
    const existing = await this.sectionRepo.findByIdForTenantAndEvent(
      validSectionId,
      validOrgId,
      validEventId,
    );

    if (!existing) {
      this.logger.error(
        `[SectionsService] Update failed — Section not found. Target ID: "${validSectionId}", Org ID: "${validOrgId}", Event ID: "${validEventId}"`,
      );
      throw new NotFoundException(`Section with ID ${validSectionId} not found for this event`);
    }

    // 3. Prepare payload, safely merging nested content objects if updated
    const updatePayload: Record<string, any> = { ...dto };

    if (dto.content) {
      updatePayload.content = {
        ...(existing.content || {}),
        ...dto.content,
      };
    }

    // 4. Update and return updated document state
    const updated = await this.sectionRepo.updateById(validSectionId, updatePayload);
    return assertFound(updated, 'Section not found after update execution');
  }

  /**
   * Reorders sections for an event based on an ordered array of section IDs.
   */
  async reorder(
    organizationId: string,
    eventId: string,
    orderedIds: string[],
  ): Promise<void> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');

    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);
    return this.sectionRepo.reorder(validEventId, orderedIds);
  }

  /**
   * Deletes a section scoped to tenant and event.
   */
  async remove(
    organizationId: string,
    eventId: string,
    id: string,
  ): Promise<{ deleted: true }> {
    const validOrgId = this.toValidId(organizationId, 'organization');
    const validEventId = this.toValidId(eventId, 'event');
    const validSectionId = this.toValidId(id, 'section');

    await this.eventsService.findByIdForTenantOrThrow(validEventId, validOrgId);

    const deleted = await this.sectionRepo.deleteByIdForTenant(validSectionId, validOrgId);
    return assertDeleted(deleted, 'Section not found or already deleted');
  }
}