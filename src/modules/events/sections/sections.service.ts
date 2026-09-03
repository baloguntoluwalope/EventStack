import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Types } from 'mongoose';

import type {
  ISectionRepository,
} from './interfaces/section-repository.interface';

import {
  SECTION_REPOSITORY,
} from './interfaces/section-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import {
  CreateSectionDto,
} from './dto/create-section.dto';

import {
  UpdateSectionDto,
} from './dto/update-section.dto';

import {
  EventsService,
} from '../events.service';

import {
  SectionDocument,
} from './schemas/section.schema';

import {
  PagesService,
} from '../pages/pages.service';

export interface BatchSectionPayload {
  organizationId: string;
  eventId: string;
  type: string;
  content: Record<string, unknown>;
  order?: number;
  visible?: boolean;
  pageId?: string;
}

@Injectable()
export class SectionsService {
  private readonly logger =
    new Logger(SectionsService.name);

  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepo:
      ISectionRepository,

    @Inject(
      forwardRef(() => EventsService),
    )
    private readonly eventsService:
      EventsService,

    @Inject(
      forwardRef(() => PagesService),
    )
    private readonly pagesService:
      PagesService,
  ) {}

  // =========================================================
  // HELPERS
  // =========================================================

  private toValidId(
    id: string,
    label: string,
  ): string {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      throw new BadRequestException(
        `Invalid ${label} ID format: ${id}`,
      );
    }

    return id;
  }

  private async resolvePageId(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<string> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    if (pageId) {
      const validPageId =
        this.toValidId(
          pageId,
          'page',
        );

      await this.pagesService
        .findByIdForTenantAndEventOrThrow(
          validPageId,
          validOrgId,
          validEventId,
        );

      return validPageId;
    }

    const homePage =
      await this.pagesService.ensureHomePage(
        validOrgId,
        validEventId,
      );

    const resolvedId =
      homePage._id?.toString() ??
      homePage.id?.toString();

    if (!resolvedId) {
      throw new BadRequestException(
        'Unable to resolve Home page ID.',
      );
    }

    return resolvedId;
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    organizationId: string,
    eventId: string,
    dto: CreateSectionDto & {
      pageId?: string;
    },
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const pageId =
      await this.resolvePageId(
        validOrgId,
        validEventId,
        dto.pageId,
      );

    return this.sectionRepo.create({
      ...dto,

      organizationId:
        validOrgId,

      eventId:
        validEventId,

      pageId,

      content:
        dto.content ?? {},

      order:
        dto.order ?? 0,

      visible:
        dto.visible ?? true,
    });
  }

  // =========================================================
  // CREATE MANY
  // =========================================================

  async createMany(
    sections: BatchSectionPayload[],
  ): Promise<SectionDocument[]> {
    if (
      !Array.isArray(sections) ||
      sections.length === 0
    ) {
      return [];
    }

    const pageCache =
      new Map<string, string>();

    const resolvedSections:
      Record<string, any>[] = [];

    for (const section of sections) {
      const orgId =
        this.toValidId(
          section.organizationId,
          'organization',
        );

      const eventId =
        this.toValidId(
          section.eventId,
          'event',
        );

      let pageId =
        section.pageId;

      if (pageId) {
        pageId =
          this.toValidId(
            pageId,
            'page',
          );

        await this.pagesService
          .findByIdForTenantAndEventOrThrow(
            pageId,
            orgId,
            eventId,
          );
      } else {
        const cacheKey =
          `${orgId}:${eventId}`;

        pageId =
          pageCache.get(cacheKey);

        if (!pageId) {
          const homePage =
            await this.pagesService
              .ensureHomePage(
                orgId,
                eventId,
              );

          pageId =
            homePage._id?.toString() ??
            homePage.id?.toString();

          if (!pageId) {
            throw new BadRequestException(
              'Unable to resolve Home page ID.',
            );
          }

          pageCache.set(
            cacheKey,
            pageId,
          );
        }
      }

      resolvedSections.push({
        type:
          section.type,

        content:
          section.content ?? {},

        organizationId:
          orgId,

        eventId:
          eventId,

        pageId,

        order:
          section.order ?? 0,

        visible:
          section.visible ?? true,
      });
    }

    if (this.sectionRepo.createMany) {
      return this.sectionRepo.createMany(
        resolvedSections,
      );
    }

    return Promise.all(
      resolvedSections.map(
        (section) =>
          this.sectionRepo.create(
            section,
          ),
      ),
    );
  }

  // =========================================================
  // FIND BY EVENT
  // =========================================================

  async findByEvent(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<SectionDocument[]> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const all =
      await this.sectionRepo.findByEvent(
        validEventId,
        validOrgId,
      );

    if (!pageId) {
      return all;
    }

    const validPageId =
      this.toValidId(
        pageId,
        'page',
      );

    await this.pagesService
      .findByIdForTenantAndEventOrThrow(
        validPageId,
        validOrgId,
        validEventId,
      );

    return all.filter(
      (section) =>
        section.pageId &&
        String(section.pageId) ===
          validPageId,
    );
  }

  // =========================================================
  // LIST FOR EVENT
  // =========================================================

async listForEvent(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<SectionDocument[]> {
    return this.findByEvent(
      organizationId,
      eventId,
      pageId,
    );
  }

  // =========================================================
  // FIND ONE
  // =========================================================

  async findOne(
    organizationId: string,
    eventId: string,
    id: string,
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    const validSectionId =
      this.toValidId(
        id,
        'section',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const section =
      await this.sectionRepo
        .findByIdForTenantAndEvent(
          validSectionId,
          validOrgId,
          validEventId,
        );

    if (!section) {
      throw new NotFoundException(
        `Section with ID ${validSectionId} not found`,
      );
    }

    return section;
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    organizationId: string,
    eventId: string,
    id: string,
    dto:
      | Partial<CreateSectionDto>
      | UpdateSectionDto
      | (Partial<CreateSectionDto> & {
          pageId?: string;
        }),
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    const validSectionId =
      this.toValidId(
        id,
        'section',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const existing =
      await this.sectionRepo
        .findByIdForTenantAndEvent(
          validSectionId,
          validOrgId,
          validEventId,
        );

    if (!existing) {
      throw new NotFoundException(
        `Section with ID ${validSectionId} not found for this event`,
      );
    }

    const updatePayload:
      Record<string, any> = {
      ...dto,
    };

    if (
      'pageId' in dto &&
      dto.pageId !== undefined
    ) {
      updatePayload.pageId =
        await this.resolvePageId(
          validOrgId,
          validEventId,
          dto.pageId,
        );
    }

    if (
      dto.content !== undefined
    ) {
      updatePayload.content = {
        ...(existing.content ?? {}),
        ...(dto.content ?? {}),
      };
    }

    const updated =
      await this.sectionRepo.updateById(
        validSectionId,
        updatePayload,
      );

    return assertFound(
      updated,
      'Section not found after update execution',
    );
  }

  // =========================================================
  // REORDER
  // =========================================================

  async reorder(
    organizationId: string,
    eventId: string,
    orderedIds: string[],
  ): Promise<void> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    if (!Array.isArray(orderedIds)) {
      throw new BadRequestException(
        'orderedIds must be an array',
      );
    }

    for (const id of orderedIds) {
      this.toValidId(
        id,
        'section',
      );
    }

    return this.sectionRepo.reorder(
      validOrgId,
      validEventId,
      orderedIds,
    );
  }

  // =========================================================
  // REMOVE
  // =========================================================

async remove(
  organizationId: string,
  eventId: string,
  id: string,
): Promise<{ deleted: true }> {
  const validOrgId =
    this.toValidId(
      organizationId,
      'organization',
    );

  const validEventId =
    this.toValidId(
      eventId,
      'event',
    );

  const validSectionId =
    this.toValidId(
      id,
      'section',
    );

  await this.eventsService
    .findByIdForTenantOrThrow(
      validEventId,
      validOrgId,
    );

  /*
   * IMPORTANT:
   *
   * Verify the section belongs to BOTH:
   *
   * organizationId
   * eventId
   *
   * before performing the delete.
   */
  const section =
    await this.sectionRepo
      .findByIdForTenantAndEvent(
        validSectionId,
        validOrgId,
        validEventId,
      );

  if (!section) {
    throw new NotFoundException(
      `Section with ID ${validSectionId} not found for this event`,
    );
  }

  const deleted =
    await this.sectionRepo
      .deleteByIdForTenant(
        validSectionId,
        validOrgId,
      );

  return assertDeleted(
    deleted,
    'Section not found or already deleted',
  );
}
}