import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Separate value and type imports to satisfy isolatedModules + emitDecoratorMetadata
import type { IEventRepository } from './interfaces/event-repository.interface';
import { EVENT_REPOSITORY } from './interfaces/event-repository.interface';

import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { SlugService } from '../../common/utils/slug.util';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventSeoDto } from './dto/update-event-seo.dto';
import { EventStatus } from '../../common/constants/event-status.constants';
import { EventPublishedDomainEvent } from './events.domain-events';

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENT_REPOSITORY) private eventRepo: IEventRepository,
    private slugService: SlugService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(organizationId: string, createdBy: string, dto: CreateEventDto) {
    const slug = await this.slugService.resolveUnique(
      dto.slug || dto.title,
      async (candidate) => !!(await this.eventRepo.findBySlug(candidate)),
    );

    return this.eventRepo.create({
      title: dto.title,
      category: dto.category,
      slug,
      organizationId: organizationId as any,
      createdBy: createdBy as any,
      status: EventStatus.DRAFT,
    });
  }

  async findByIdForTenantOrThrow(id: string, organizationId: string) {
    return assertFound(
      await this.eventRepo.findByIdForTenant(id, organizationId),
      'Event not found',
    );
  }

  async findPublishedBySlug(slug: string) {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event || event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Event not found or not published');
    }
    return event;
  }

  listForOrganization(organizationId: string, page?: number, limit?: number) {
    return this.eventRepo.findManyForTenant(organizationId, { page, limit });
  }

  async update(id: string, organizationId: string, dto: Partial<CreateEventDto>) {
    await this.findByIdForTenantOrThrow(id, organizationId); // ownership check
    return assertFound(await this.eventRepo.updateById(id, dto), 'Event not found');
  }

  async updateSeoFields(id: string, organizationId: string, dto: UpdateEventSeoDto) {
    await this.findByIdForTenantOrThrow(id, organizationId); // ownership check
    return assertFound(await this.eventRepo.updateById(id, dto), 'Event not found');
  }

  /**
   * Deliberately global, not tenant-scoped — same exception as findBySlug.
   * A sitemap is inherently a public, platform-wide artifact; there is no
   * tenant context to scope it by.
   */
  findAllPublished() {
    return this.eventRepo.findAllPublished();
  }

  async publish(id: string, organizationId: string, publishedByUserId: string) {
    const event = await this.findByIdForTenantOrThrow(id, organizationId);
    const updated = await this.eventRepo.updateById(id, {
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    this.eventEmitter.emit(
      'event.published',
      new EventPublishedDomainEvent(organizationId, id, event.title, event.slug, publishedByUserId),
    );

    return updated;
  }

  async archive(id: string, organizationId: string) {
    await this.findByIdForTenantOrThrow(id, organizationId);
    return assertFound(
      await this.eventRepo.updateById(id, { status: EventStatus.ARCHIVED }),
      'Event not found',
    );
  }

  async duplicate(id: string, organizationId: string, createdBy: string) {
    const original = await this.findByIdForTenantOrThrow(id, organizationId);
    const newSlug = await this.slugService.resolveUnique(
      original.title,
      async (candidate) => !!(await this.eventRepo.findBySlug(candidate)),
    );
    return this.eventRepo.create({
      title: `${original.title} (Copy)`,
      category: original.category,
      slug: newSlug,
      organizationId: organizationId as any,
      createdBy: createdBy as any,
      status: EventStatus.DRAFT,
    });
  }

  async remove(id: string, organizationId: string) {
    return assertDeleted(
      await this.eventRepo.deleteByIdForTenant(id, organizationId),
      'Event not found',
    );
  }
}