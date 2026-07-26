import { Injectable, Inject } from '@nestjs/common';

// Separate the interface (type) from the token (value)
import type { ISectionRepository } from './interfaces/section-repository.interface';
import { SECTION_REPOSITORY } from './interfaces/section-repository.interface';

import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateSectionDto } from './dto/create-section.dto';
import { EventsService } from '../events.service';

@Injectable()
export class SectionsService {
  constructor(
    @Inject(SECTION_REPOSITORY) private sectionRepo: ISectionRepository,
    private eventsService: EventsService,
  ) {}

  async create(organizationId: string, eventId: string, dto: CreateSectionDto) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);
    return this.sectionRepo.create({
      ...dto,
      organizationId: organizationId as any,
      eventId: eventId as any,
    });
  }

  async listForEvent(organizationId: string, eventId: string) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);
    return this.sectionRepo.findByEvent(eventId);
  }

  async update(organizationId: string, id: string, dto: Partial<CreateSectionDto>) {
    await assertFound(
      await this.sectionRepo.findByIdForTenant(id, organizationId),
      'Section not found',
    );
    return assertFound(await this.sectionRepo.updateById(id, dto), 'Section not found');
  }

  async reorder(organizationId: string, eventId: string, orderedIds: string[]) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);
    return this.sectionRepo.reorder(eventId, orderedIds);
  }

  async remove(organizationId: string, id: string) {
    return assertDeleted(
      await this.sectionRepo.deleteByIdForTenant(id, organizationId),
      'Section not found',
    );
  }
}