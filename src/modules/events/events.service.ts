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

import {
  assertFound,
  assertDeleted,
} from '../../common/utils/assert-found.util';

import { SlugService } from '../../common/utils/slug.util';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventSeoDto } from './dto/update-event-seo.dto';

import { EventStatus } from '../../common/constants/event-status.constants';
import { EventPublishedDomainEvent } from './events.domain-events';

import { TemplatesService } from './templates/templates.service';
import { SectionsService } from './sections/sections.service';
import { PagesService } from './pages/pages.service';

import { TournamentsService } from '../sports/tournaments/tournaments.service';

import { EventType } from './schemas/event.schema';
import {
  TournamentFormat,
} from '../sports/tournaments/schemas/tournament.schema';

const MONGO_DUPLICATE_KEY_CODE = 11000;

const SUPPORTED_SECTION_TYPES = new Set([
  // General
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

  // Sports
  'live_match',
  'fixtures',
  'standings',
  'teams',
  'knockout_bracket',
]);

type PreviewTemplate = {
  id: string;
  name: string;
  slug: string;
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(
    EventsService.name,
  );

  constructor(
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepo: IEventRepository,

    private readonly slugService: SlugService,

    private readonly eventEmitter: EventEmitter2,

    private readonly templatesService: TemplatesService,

    @Inject(forwardRef(() => SectionsService))
    private readonly sectionsService: SectionsService,

    @Inject(forwardRef(() => PagesService))
    private readonly pagesService: PagesService,

    private readonly tournamentsService: TournamentsService,
  ) {}

  // =========================================================
  // HELPERS
  // =========================================================

  private toObjectId(id: string): Types.ObjectId {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `Invalid ID format: ${id}`,
      );
    }

    return new Types.ObjectId(id);
  }

  private getDocumentId(document: any): string {
    return (
      document?._id?.toString() ||
      document?.id
    );
  }

  private getTemplateId(template: any): string | null {
    if (!template) {
      return null;
    }

    return (
      template._id?.toString() ??
      template.id?.toString() ??
      null
    );
  }

  private getEventType(event: any): EventType {
    return (
      event?.type ??
      event?.eventType ??
      EventType.GENERAL
    );
  }

  // =========================================================
  // CREATE EVENT
  // =========================================================

  async create(
    organizationId: string,
    createdBy: string,
    dto: CreateEventDto,
  ) {
    const slug =
      await this.slugService.resolveUnique(
        dto.slug || dto.title,
        async (candidate) =>
          !!(
            await this.eventRepo.findBySlug(
              candidate,
            )
          ),
      );

    // =======================================================
    // SPORTS EVENT
    // =======================================================

    if (dto.type === EventType.SPORTS) {
      return this.createSportsEvent(
        organizationId,
        createdBy,
        dto,
        slug,
      );
    }

    // =======================================================
    // GENERAL EVENT
    // =======================================================

    const orgObjectId =
      this.toObjectId(organizationId);

    const creatorObjectId =
      this.toObjectId(createdBy);

    let event;

    try {
      event =
        await this.eventRepo.create({
          title: dto.title,

          category: dto.category,

          eventDate: dto.eventDate
            ? new Date(dto.eventDate)
            : undefined,

          slug,

          organizationId:
            orgObjectId,

          createdBy:
            creatorObjectId,

          templateId:
            dto.templateId
              ? this.toObjectId(
                  dto.templateId,
                )
              : undefined,

          type:
            EventType.GENERAL,

          status:
            EventStatus.DRAFT,
        });
    } catch (err: any) {
      if (
        err?.code ===
          MONGO_DUPLICATE_KEY_CODE &&
        err?.keyPattern?.slug
      ) {
        const fallbackSlug =
          `${slug}-${Math.random()
            .toString(36)
            .substring(2, 7)}`;

        event =
          await this.eventRepo.create({
            title: dto.title,

            category: dto.category,

            eventDate: dto.eventDate
              ? new Date(dto.eventDate)
              : undefined,

            slug:
              fallbackSlug,

            organizationId:
              orgObjectId,

            createdBy:
              creatorObjectId,

            templateId:
              dto.templateId
                ? this.toObjectId(
                    dto.templateId,
                  )
                : undefined,

            type:
              EventType.GENERAL,

            status:
              EventStatus.DRAFT,
          });
      } else {
        throw err;
      }
    }

    const eventId =
      this.getDocumentId(event);

    // =======================================================
    // GENERAL EVENT WEBSITE INITIALIZATION
    // =======================================================

    if (dto.templateId) {
      try {
        await this.seedSectionsFromTemplate(
          organizationId,
          eventId,
          dto.templateId,
          dto.title,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to seed template for event ${eventId}: ${err.message}`,
          err.stack,
        );
      }
    } else {
      await this.pagesService.ensureHomePage(
        organizationId,
        eventId,
      );
    }

    return event;
  }

  // =========================================================
  // CREATE SPORTS EVENT
  // =========================================================

  private async createSportsEvent(
    organizationId: string,
    createdBy: string,
    dto: CreateEventDto,
    slug: string,
  ) {
    const orgObjectId =
      this.toObjectId(organizationId);

    const creatorObjectId =
      this.toObjectId(createdBy);

    return this.eventRepo.withTransaction(
      async (session) => {
        const event =
          await this.eventRepo.create(
            {
              title: dto.title,

              category: dto.category,

              eventDate: dto.eventDate
                ? new Date(dto.eventDate)
                : undefined,

              slug,

              organizationId:
                orgObjectId,

              createdBy:
                creatorObjectId,

              /*
               * IMPORTANT:
               *
               * A sports event does NOT receive a website
               * template during event creation.
               *
               * The organizer must choose the sports website
               * template from the Website page.
               */
              type:
                EventType.SPORTS,

              status:
                EventStatus.DRAFT,
            },
            session,
          );

        const eventId =
          this.getDocumentId(event);

        const tournament =
          await this.tournamentsService.createWithSession(
            organizationId,
            eventId,
            {
              name: dto.title,

              sport:
                dto.sport ||
                'football',

              format:
                (dto.competitionFormat as TournamentFormat) ||
                TournamentFormat.KNOCKOUT_ONLY,

              tieBreakRules:
                dto.tieBreakRules,
            },
            session,
          );

        /*
         * DO NOT create a Home page here.
         *
         * This is intentional.
         *
         * Sports flow:
         *
         * Create tournament
         *       ↓
         * Open Website
         *       ↓
         * Pick sports template
         *       ↓
         * Template creates Home page
         *       ↓
         * Template creates sections
         */

        const plainEvent =
          typeof (event as any).toObject ===
          'function'
            ? (event as any).toObject()
            : event;

        const plainTournament =
          typeof (tournament as any).toObject ===
          'function'
            ? (tournament as any).toObject()
            : tournament;

        return {
          event: {
            id:
              plainEvent._id?.toString() ||
              plainEvent.id,

            title:
              plainEvent.title,

            category:
              plainEvent.category,

            slug:
              plainEvent.slug,

            status:
              plainEvent.status,

            type:
              plainEvent.type,

            organizationId:
              plainEvent.organizationId?.toString(),

            createdBy:
              plainEvent.createdBy?.toString(),

            createdAt:
              plainEvent.createdAt,
          },

          tournament: {
            id:
              plainTournament._id?.toString() ||
              plainTournament.id,

            eventId,

            name:
              plainTournament.name,

            sport:
              plainTournament.sport,

            format:
              plainTournament.format,

            tieBreakRules:
              plainTournament.tieBreakRules,
          },
        };
      },
    );
  }

  // =========================================================
  // FIND EVENT
  // =========================================================

  async findByIdForTenantOrThrow(
    id: string,
    organizationId: string,
  ) {
    const event =
      await this.eventRepo.findByIdForTenant(
        id,
        organizationId,
      );

    return assertFound(
      event,
      'Event not found',
    );
  }

  // =========================================================
  // APPLY TEMPLATE
  // =========================================================

  async applyTemplate(
    id: string,
    organizationId: string,
    templateId: string,
  ) {
    if (!templateId) {
      throw new BadRequestException(
        'templateId is required.',
      );
    }

    const event =
      await this.findByIdForTenantOrThrow(
        id,
        organizationId,
      );

    const eventRecord =
      event as any;

    const eventType =
      this.getEventType(eventRecord);

    const template =
      await this.templatesService.findByIdOrThrow(
        templateId,
      );

    // =======================================================
    // SPORTS TEMPLATE VALIDATION
    // =======================================================

    if (
      eventType === EventType.SPORTS &&
      String(template.category).toLowerCase() !==
        'sports'
    ) {
      throw new BadRequestException(
        'A sports event can only use a sports website template.',
      );
    }

    // =======================================================
    // ALREADY SELECTED TEMPLATE
    // =======================================================

    const currentTemplateId =
      eventRecord.templateId?.toString() ??
      null;

    if (
      currentTemplateId &&
      currentTemplateId === templateId
    ) {
      throw new BadRequestException(
        'This event already has this website template applied.',
      );
    }

    /*
     * IMPORTANT:
     *
     * Do NOT reject a sports event simply because it has
     * an empty Home page.
     *
     * Older sports events may already have a Home page
     * because previous versions of the application created
     * one automatically.
     *
     * What matters is whether actual sections exist.
     */

    const existingSections =
      await this.sectionsService.listForEvent(
        organizationId,
        id,
      );

    if (
      existingSections.length > 0
    ) {
      throw new BadRequestException(
        'This event already has website content. Remove the existing sections before applying a different template.',
      );
    }

    // =======================================================
    // TEMPLATE CONTENT VALIDATION
    // =======================================================

    const hasPages =
      Array.isArray(template.defaultPages) &&
      template.defaultPages.length > 0;

    const hasSections =
      Array.isArray(template.defaultSections) &&
      template.defaultSections.length > 0;

    if (!hasPages && !hasSections) {
      throw new BadRequestException(
        'This template has no default pages or default sections.',
      );
    }

    // =======================================================
    // SEED
    // =======================================================

    await this.seedSectionsFromTemplate(
      organizationId,
      id,
      templateId,
      eventRecord.title,
    );

    // =======================================================
    // SAVE TEMPLATE ID
    // =======================================================

    const updated =
      await this.eventRepo.updateById(
        id,
        {
          templateId:
            this.toObjectId(
              templateId,
            ),
        },
      );

    return {
      applied: true,

      eventId: id,

      templateId,

      event:
        updated ?? event,
    };
  }

  // =========================================================
  // EVENT PREVIEW
  // =========================================================

  async getEventPreview(
    id: string,
    organizationId: string,
  ) {
    const event =
      await this.findByIdForTenantOrThrow(
        id,
        organizationId,
      );

    const eventRecord =
      event as any;

    // =======================================================
    // PAGES
    // =======================================================

    const pages =
      await this.pagesService.listForEvent(
        id,
        organizationId,
      );

    const homePage =
      pages.find(
        (page: any) =>
          page.isHome === true,
      ) ??
      pages[0];

    // =======================================================
    // SECTIONS
    // =======================================================

    const sections =
      await this.sectionsService.findByEvent(
        organizationId,
        id,
      );

    // =======================================================
    // TEMPLATE
    // =======================================================

    let template: PreviewTemplate | null =
      null;

    if (eventRecord.templateId) {
      const templateId =
        eventRecord.templateId.toString();

      try {
        const templateRecord =
          await this.templatesService.findByIdOrThrow(
            templateId,
          );

        const resolvedTemplateId =
          this.getTemplateId(
            templateRecord,
          );

        if (resolvedTemplateId) {
          template = {
            id:
              resolvedTemplateId,

            name:
              templateRecord.name,

            slug:
              templateRecord.slug ??
              '',
          };
        }
      } catch (err: any) {
        /*
         * Do not make the entire website page fail because
         * an old/deleted template reference exists.
         */

        this.logger.warn(
          `Unable to resolve template ${eventRecord.templateId} for event ${id}: ${err.message}`,
        );
      }
    }

    // =======================================================
    // RESPONSE
    // =======================================================

    return {
      event: {
        id:
          eventRecord._id?.toString() ||
          eventRecord.id,

        organizationId,

        title:
          eventRecord.title,

        slug:
          eventRecord.slug,

        category:
          eventRecord.category,

        status:
          eventRecord.status,

        publishedAt:
          eventRecord.publishedAt ??
          null,

        qrCodeUrl:
          eventRecord.qrCodeUrl ??
          null,

        templateId:
          eventRecord.templateId?.toString() ??
          null,

        type:
          eventRecord.type ||
          EventType.GENERAL,

        eventType:
          eventRecord.type ||
          EventType.GENERAL,
      },

      template,

      pages:
        pages.map(
          (page: any) => ({
            id:
              page._id?.toString() ||
              page.id,

            title:
              page.title,

            slug:
              page.slug,

            isHome:
              page.isHome,

            showInNav:
              page.showInNav,

            order:
              page.order,
          }),
        ),

      currentPageId:
        homePage?._id?.toString() ||
        homePage?.id ||
        '',

      currentPageSlug:
        homePage?.slug ??
        '',

      theme:
        eventRecord.theme
          ? {
              tokens:
                eventRecord.theme,
            }
          : null,

      sections,
    };
  }

  // =========================================================
  // PUBLIC EVENT
  // =========================================================

  async findPublishedBySlug(
    slug: string,
  ) {
    const event =
      await this.eventRepo.findBySlug(
        slug,
      );

    if (
      !event ||
      event.status !==
        EventStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Event not found or not published',
      );
    }

    return event;
  }

  // =========================================================
  // LIST
  // =========================================================

  listForOrganization(
    organizationId: string,
    page = 1,
    limit = 10,
  ) {
    return this.eventRepo.findManyForTenant(
      organizationId,
      {
        page,
        limit,
      },
    );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    id: string,
    organizationId: string,
    dto: Partial<CreateEventDto>,
  ) {
    await this.findByIdForTenantOrThrow(
      id,
      organizationId,
    );

    const updatePayload: Record<
      string,
      any
    > = {
      ...dto,
    };

    if (dto.eventDate) {
      updatePayload.eventDate =
        new Date(dto.eventDate);
    }

    if (dto.templateId) {
      updatePayload.templateId =
        this.toObjectId(
          dto.templateId,
        );
    }

    return assertFound(
      await this.eventRepo.updateById(
        id,
        updatePayload,
      ),
      'Event not found',
    );
  }

  // =========================================================
  // SEO
  // =========================================================

  async updateSeoFields(
    id: string,
    organizationId: string,
    dto: UpdateEventSeoDto,
  ) {
    await this.findByIdForTenantOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.eventRepo.updateById(
        id,
        dto,
      ),
      'Event not found',
    );
  }

  // =========================================================
  // PUBLISHED
  // =========================================================

  findAllPublished() {
    return this.eventRepo.findAllPublished();
  }

  // =========================================================
  // PUBLISH
  // =========================================================

  async publish(
    id: string,
    organizationId: string,
    publishedByUserId: string,
  ) {
    const event =
      await this.findByIdForTenantOrThrow(
        id,
        organizationId,
      );

    const updated =
      await this.eventRepo.updateById(
        id,
        {
          status:
            EventStatus.PUBLISHED,

          publishedAt:
            new Date(),
        },
      );

    this.eventEmitter.emit(
      'event.published',
      new EventPublishedDomainEvent(
        organizationId,
        id,
        event.title,
        event.slug,
        publishedByUserId,
      ),
    );

    return updated;
  }

  // =========================================================
  // ARCHIVE
  // =========================================================

  async archive(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdForTenantOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.eventRepo.updateById(
        id,
        {
          status:
            EventStatus.ARCHIVED,
        },
      ),
      'Event not found',
    );
  }

  // =========================================================
  // DUPLICATE
  // =========================================================

  async duplicate(
    id: string,
    organizationId: string,
    createdBy: string,
  ) {
    const original =
      await this.findByIdForTenantOrThrow(
        id,
        organizationId,
      );

    const record =
      original as any;

    const newSlug =
      await this.slugService.resolveUnique(
        record.title,
        async (candidate) =>
          !!(
            await this.eventRepo.findBySlug(
              candidate,
            )
          ),
      );

    const duplicated =
      await this.eventRepo.create({
        title:
          `${record.title} (Copy)`,

        category:
          record.category,

        eventDate:
          record.eventDate,

        slug:
          newSlug,

        type:
          record.type ||
          EventType.GENERAL,

        organizationId:
          this.toObjectId(
            organizationId,
          ),

        createdBy:
          this.toObjectId(
            createdBy,
          ),

        status:
          EventStatus.DRAFT,
      });

    /*
     * Duplicated events start without website content.
     *
     * The organizer can choose a template afterwards.
     */
    await this.pagesService.ensureHomePage(
      organizationId,
      this.getDocumentId(duplicated),
    );

    return duplicated;
  }

  // =========================================================
  // DELETE
  // =========================================================

  async remove(
    id: string,
    organizationId: string,
  ) {
    return assertDeleted(
      await this.eventRepo.deleteByIdForTenant(
        id,
        organizationId,
      ),
      'Event not found',
    );
  }

  // =========================================================
  // STATUS COUNTS
  // =========================================================

  async countByStatus() {
    const statuses = [
      EventStatus.DRAFT,
      EventStatus.PUBLISHED,
      'ongoing',
      'completed',
      EventStatus.ARCHIVED,
    ];

    if (!this.eventRepo.count) {
      return Object.fromEntries(
        statuses.map((status) => [
          status,
          0,
        ]),
      );
    }

    const counts =
      await Promise.all(
        statuses.map((status) =>
          this.eventRepo
            .count({ status })
            .catch(() => 0),
        ),
      );

    return Object.fromEntries(
      statuses.map(
        (status, index) => [
          status,
          counts[index] ?? 0,
        ],
      ),
    );
  }

  // =========================================================
  // TOURNAMENT
  // =========================================================

  async getTournamentForEvent(
    eventId: string,
    organizationId: string,
  ) {
    await this.findByIdForTenantOrThrow(
      eventId,
      organizationId,
    );

    return this.tournamentsService
      .findOneByEventOrThrow(
        eventId,
        organizationId,
      );
  }

  // =========================================================
  // SEED TEMPLATE
  // =========================================================

  private async seedSectionsFromTemplate(
    organizationId: string,
    eventId: string,
    templateId: string,
    eventTitle?: string,
  ) {
    const template =
      await this.templatesService.findByIdOrThrow(
        templateId,
      );

    this.logger.log(
      `Starting template seeding for event ${eventId} using template ${templateId}`,
    );

    // =======================================================
    // HOME PAGE
    // =======================================================

    const homePage =
      await this.pagesService.ensureHomePage(
        organizationId,
        eventId,
      );

    const homePageId =
      homePage._id?.toString() ??
      homePage.id?.toString();

    if (!homePageId) {
      throw new BadRequestException(
        'Unable to resolve Home page ID.',
      );
    }

    // =======================================================
    // MULTI-PAGE TEMPLATE
    // =======================================================

    if (
      Array.isArray(template.defaultPages) &&
      template.defaultPages.length > 0
    ) {
      const sectionsToCreate: Array<{
        organizationId: string;
        eventId: string;
        pageId: string;
        type: string;
        content: Record<string, any>;
        order: number;
        visible: boolean;
      }> = [];

      for (
        let pageIndex = 0;
        pageIndex <
        template.defaultPages.length;
        pageIndex++
      ) {
        const templatePage =
          template.defaultPages[
            pageIndex
          ];

        let eventPage;

        if (templatePage.isHome) {
          eventPage = homePage;
        } else {
          eventPage =
            await this.pagesService.create(
              eventId,
              organizationId,
              {
                title:
                  templatePage.title,

                slug:
                  templatePage.slug ||
                  templatePage.title,
              },
            );
        }

        const pageId =
          eventPage._id?.toString() ??
          eventPage.id?.toString();

        if (!pageId) {
          throw new BadRequestException(
            `Unable to resolve page ID for template page "${templatePage.title}".`,
          );
        }

        const pageSections =
          Array.isArray(
            templatePage.sections,
          )
            ? templatePage.sections
            : [];

        for (
          let sectionIndex = 0;
          sectionIndex <
          pageSections.length;
          sectionIndex++
        ) {
          const section =
            pageSections[
              sectionIndex
            ];

          const type =
            String(
              section.type ?? '',
            ).trim();

          if (
            !type ||
            !SUPPORTED_SECTION_TYPES.has(
              type,
            )
          ) {
            this.logger.warn(
              `Skipping unsupported section "${type}" from template ${templateId}.`,
            );

            continue;
          }

          const content = {
            ...(section.content ?? {}),
          };

          if (
            type === 'hero' &&
            eventTitle
          ) {
            content.heading =
              eventTitle;
          }

          sectionsToCreate.push({
            organizationId,

            eventId,

            pageId,

            type,

            content,

            order:
              section.order ??
              sectionIndex,

            visible: true,
          });
        }
      }

      if (
        sectionsToCreate.length > 0
      ) {
        await this.sectionsService.createMany(
          sectionsToCreate,
        );
      }

      return;
    }

    // =======================================================
    // LEGACY SINGLE-PAGE TEMPLATE
    // =======================================================

    if (
      !Array.isArray(
        template.defaultSections,
      ) ||
      template.defaultSections.length ===
        0
    ) {
      this.logger.warn(
        `Template ${templateId} has no default pages or default sections.`,
      );

      return;
    }

    const sectionsToCreate: Array<{
      organizationId: string;
      eventId: string;
      pageId: string;
      type: string;
      content: Record<string, any>;
      order: number;
      visible: boolean;
    }> = [];

    template.defaultSections.forEach(
      (section, index) => {
        const type =
          String(
            section.type ?? '',
          ).trim();

        if (
          !type ||
          !SUPPORTED_SECTION_TYPES.has(
            type,
          )
        ) {
          this.logger.warn(
            `Skipping unsupported section "${type}" from template ${templateId}.`,
          );

          return;
        }

        const content = {
          ...(section.content ?? {}),
        };

        if (
          type === 'hero' &&
          eventTitle
        ) {
          content.heading =
            eventTitle;
        }

        sectionsToCreate.push({
          organizationId,

          eventId,

          pageId:
            homePageId,

          type,

          content,

          order:
            section.order ??
            index,

          visible: true,
        });
      },
    );

    if (
      sectionsToCreate.length > 0
    ) {
      await this.sectionsService.createMany(
        sectionsToCreate,
      );
    }
  }
}