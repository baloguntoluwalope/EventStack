import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import type { IEventRepository } from './interfaces/event-repository.interface';
import { EVENT_REPOSITORY } from './interfaces/event-repository.interface';

import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { SlugService } from '../../common/utils/slug.util';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventSeoDto } from './dto/update-event-seo.dto';
import { EventStatus } from '../../common/constants/event-status.constants';
import { EventPublishedDomainEvent } from './events.domain-events';
import { TemplatesService } from './templates/templates.service';
import { SectionsService } from './sections/sections.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @Inject(EVENT_REPOSITORY) private readonly eventRepo: IEventRepository,
    private readonly slugService: SlugService,
    private readonly eventEmitter: EventEmitter2,
    private readonly templatesService: TemplatesService,
    @Inject(forwardRef(() => SectionsService))
    private readonly sectionsService: SectionsService,
  ) {}

  /**
   * Helper to ensure ID inputs are safely cast to valid MongoDB ObjectIds.
   */
  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ID format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  async create(organizationId: string, createdBy: string, dto: CreateEventDto) {
    const slug = await this.slugService.resolveUnique(
      dto.slug || dto.title!,
      async (candidate) => !!(await this.eventRepo.findBySlug(candidate)),
    );

    const orgObjectId = this.toObjectId(organizationId);
    const creatorObjectId = this.toObjectId(createdBy);

    const event = await this.eventRepo.create({
      title: dto.title,
      category: dto.category,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      slug,
      organizationId: orgObjectId as any,
      createdBy: creatorObjectId as any,
      templateId: dto.templateId ? (this.toObjectId(dto.templateId) as any) : undefined,
      status: EventStatus.DRAFT,
    });

    if (dto.templateId) {
      const eventId = (event as any)._id?.toString() || (event as any).id;
      
      try {
        await this.seedSectionsFromTemplate(
          organizationId,
          eventId,
          dto.templateId,
          dto.title,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to seed sections for event ${eventId} from template ${dto.templateId}: ${err.message}`,
          err.stack,
        );
        // Do not block event creation if template seeding encounters an edge case
      }
    }

    return event;
  }

  private async seedSectionsFromTemplate(
    organizationId: string,
    eventId: string,
    templateId: string,
    eventTitle?: string,
  ): Promise<void> {
    const template = await this.templatesService.findByIdOrThrow(templateId);

    if (!template.defaultSections?.length) {
      return;
    }

    const supportedTypes = new Set([
      'hero',
      'about',
      'countdown',
      'programme',
      'speakers',
      'committee',
      'gallery',
      'venue',
      'donation',
      'livestream',
      'contact',
      'faq',
      'sponsors',
      'footer',
      'testimonials',
    ]);

    const sectionsToCreate = template.defaultSections
      .filter((defaultSection: any) => {
        const type = String(defaultSection.type ?? '').trim();
        return type && supportedTypes.has(type);
      })
      .map((defaultSection: any, index: number) => {
        const content = { ...(defaultSection.defaultContent ?? defaultSection.content ?? {}) };

        if (defaultSection.type === 'hero' && eventTitle) {
          content.heading = eventTitle;
        }

        return {
          organizationId,
          eventId,
          type: defaultSection.type,
          content,
          order: index,
          visible: defaultSection.visible ?? true,
        };
      });

    if (sectionsToCreate.length === 0) {
      return;
    }

    // Check if sectionsService exposes bulk creation or fallback to sequential batching
    if (typeof (this.sectionsService as any).createMany === 'function') {
      await (this.sectionsService as any).createMany(sectionsToCreate);
    } else {
      // Use sequential for-of loop instead of Promise.all to prevent DB connection pool exhaustion / deadlocks
      for (const sectionData of sectionsToCreate) {
        await this.sectionsService.create(organizationId, eventId, {
          type: sectionData.type as any,
          content: sectionData.content,
        });
      }
    }
  }

  async findByIdForTenantOrThrow(id: string, organizationId: string) {
    const validEventId = this.toObjectId(id).toString();
    const validOrgId = this.toObjectId(organizationId).toString();

    return assertFound(
      await this.eventRepo.findByIdForTenant(validEventId, validOrgId),
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
    const validOrgId = this.toObjectId(organizationId).toString();
    return this.eventRepo.findManyForTenant(validOrgId, { page, limit });
  }

  async update(id: string, organizationId: string, dto: Partial<CreateEventDto>) {
    await this.findByIdForTenantOrThrow(id, organizationId);

    const updatePayload: Record<string, any> = { ...dto };

    if (dto.eventDate) {
      updatePayload.eventDate = new Date(dto.eventDate);
    }

    if (dto.templateId) {
      updatePayload.templateId = this.toObjectId(dto.templateId);
    }

    return assertFound(
      await this.eventRepo.updateById(id, updatePayload as any),
      'Event not found',
    );
  }

  async updateSeoFields(id: string, organizationId: string, dto: UpdateEventSeoDto) {
    await this.findByIdForTenantOrThrow(id, organizationId);
    return assertFound(await this.eventRepo.updateById(id, dto), 'Event not found');
  }

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

    const orgObjectId = this.toObjectId(organizationId);
    const creatorObjectId = this.toObjectId(createdBy);

    return this.eventRepo.create({
      title: `${original.title} (Copy)`,
      category: original.category,
      eventDate: original.eventDate,
      slug: newSlug,
      organizationId: orgObjectId as any,
      createdBy: creatorObjectId as any,
      status: EventStatus.DRAFT,
    });
  }

  async remove(id: string, organizationId: string) {
    const validEventId = this.toObjectId(id).toString();
    const validOrgId = this.toObjectId(organizationId).toString();

    return assertDeleted(
      await this.eventRepo.deleteByIdForTenant(validEventId, validOrgId),
      'Event not found',
    );
  }

  // --- Aggregations & Metrics ---

  async countByStatus() {
    const statuses = [
      EventStatus.DRAFT,
      EventStatus.PUBLISHED,
      'ongoing',
      'completed',
      EventStatus.ARCHIVED,
    ];

    if (typeof this.eventRepo.count !== 'function') {
      return Object.fromEntries(statuses.map((s) => [s, 0]));
    }

    const counts = await Promise.all(
      statuses.map((s) => this.eventRepo.count!({ status: s } as any).catch(() => 0)),
    );

    return Object.fromEntries(
      statuses.map((s, i) => [s, counts[i] ?? 0]),
    ) as Record<string, number>;
  }
}