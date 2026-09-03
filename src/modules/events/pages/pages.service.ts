import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import {
  Types,
} from 'mongoose';

import {
  IPageRepository,
  PAGE_REPOSITORY,
} from './interfaces/page-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import {
  SlugService,
} from '../../../common/utils/slug.util';

import {
  CreatePageDto,
} from './dto/create-page.dto';

@Injectable()
export class PagesService {
  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: IPageRepository,

    private readonly slugService: SlugService,
  ) {}

  // =========================================================
  // ID VALIDATION
  // =========================================================

  private toObjectId(
    id: string,
    label: string,
  ): Types.ObjectId {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      throw new BadRequestException(
        `Invalid ${label} ID: ${id}`,
      );
    }

    return new Types.ObjectId(id);
  }

  // =========================================================
  // CREATE HOME PAGE
  // =========================================================

  /**
   * Create the mandatory Home page for an event.
   *
   * organizationId and eventId are explicitly converted to
   * MongoDB ObjectIds before being persisted.
   */
  async createHomePage(
    organizationId: string,
    eventId: string,
  ) {
    const organizationObjectId =
      this.toObjectId(
        organizationId,
        'organization',
      );

    const eventObjectId =
      this.toObjectId(
        eventId,
        'event',
      );

    return this.pageRepo.create({
      organizationId:
        organizationObjectId,

      eventId:
        eventObjectId,

      title: 'Home',

      slug: '',

      order: 0,

      isHome: true,

      showInNav: true,
    });
  }

  // =========================================================
  // ENSURE HOME PAGE
  // =========================================================

  /**
   * Ensure that exactly one Home page exists for the event
   * within the organization.
   *
   * The unique eventId + slug index protects against races.
   */
  async ensureHomePage(
    organizationId: string,
    eventId: string,
  ) {
    this.toObjectId(
      organizationId,
      'organization',
    );

    this.toObjectId(
      eventId,
      'event',
    );

    const existing =
      await this.pageRepo.findHomeForEvent(
        eventId,
        organizationId,
      );

    if (existing) {
      return existing;
    }

    try {
      return await this.createHomePage(
        organizationId,
        eventId,
      );
    } catch (err: any) {
      /*
       * Another request may have created Home between
       * the lookup and insert.
       *
       * E11000 is expected in that race.
       */
      if (
        err?.code === 11000
      ) {
        const winner =
          await this.pageRepo.findHomeForEvent(
            eventId,
            organizationId,
          );

        if (winner) {
          return winner;
        }
      }

      throw err;
    }
  }

  // =========================================================
  // CREATE NORMAL PAGE
  // =========================================================

  async create(
    eventId: string,
    organizationId: string,
    dto: CreatePageDto,
  ) {
    this.toObjectId(
      eventId,
      'event',
    );

    this.toObjectId(
      organizationId,
      'organization',
    );

    const slug =
      await this.slugService.resolveUnique(
        dto.slug || dto.title,

        async (candidate) =>
          !!(
            await this.pageRepo.findBySlugForEvent(
              eventId,
              candidate,
            )
          ),
      );

    if (slug === '') {
      throw new BadRequestException(
        'Only the home page may use an empty slug',
      );
    }

    const pages =
      await this.pageRepo.findByEventForTenant(
        eventId,
        organizationId,
      );

    return this.pageRepo.create({
      organizationId:
        this.toObjectId(
          organizationId,
          'organization',
        ),

      eventId:
        this.toObjectId(
          eventId,
          'event',
        ),

      title:
        dto.title,

      slug,

      order:
        pages.length,

      isHome:
        false,

      showInNav:
        true,
    });
  }

  // =========================================================
  // LIST EVENT PAGES
  // =========================================================

  listForEvent(
    eventId: string,
    organizationId: string,
  ) {
    return this.pageRepo.findByEventForTenant(
      eventId,
      organizationId,
    );
  }

  // =========================================================
  // FIND PAGE
  // =========================================================

  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    return assertFound(
      await this.pageRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Page not found',
    );
  }

  // =========================================================
  // FIND PAGE FOR EVENT
  // =========================================================

  async findByIdForTenantAndEventOrThrow(
    id: string,
    organizationId: string,
    eventId: string,
  ) {
    const page =
      await this.pageRepo.findByIdForTenantAndEvent(
        id,
        organizationId,
        eventId,
      );

    if (!page) {
      throw new NotFoundException(
        `Page with ID ${id} not found for this event`,
      );
    }

    return page;
  }

  // =========================================================
  // UPDATE PAGE
  // =========================================================

  async update(
    id: string,
    organizationId: string,
    data: Partial<
      CreatePageDto & {
        showInNav: boolean;
        order: number;
      }
    >,
  ) {
    const page =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    if (
      page.isHome &&
      data.slug !== undefined &&
      data.slug !== ''
    ) {
      throw new BadRequestException(
        "The home page's slug cannot be changed from empty",
      );
    }

    return assertFound(
      await this.pageRepo.updateById(
        id,
        data as any,
      ),
      'Page not found',
    );
  }

  // =========================================================
  // DELETE PAGE
  // =========================================================

  async remove(
    id: string,
    organizationId: string,
  ) {
    const page =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    if (page.isHome) {
      throw new BadRequestException(
        'The home page cannot be deleted',
      );
    }

    return assertDeleted(
      await this.pageRepo.deleteByIdForTenant(
        id,
        organizationId,
      ),
      'Page not found',
    );
  }

  // =========================================================
  // PUBLIC PAGE RESOLUTION
  // =========================================================

  async resolvePublic(
    eventId: string,
    slug: string,
  ) {
    if (!slug) {
      return this.pageRepo.findHomeForEvent(
        eventId,
      );
    }

    return this.pageRepo.findBySlugForEvent(
      eventId,
      slug,
    );
  }
}