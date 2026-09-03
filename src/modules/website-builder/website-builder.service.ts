import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { EventsService } from '../events/events.service';
import { TemplatesService } from '../events/templates/templates.service';
import { ThemesService } from '../events/themes/themes.service';
import { SectionsService } from '../events/sections/sections.service';
import { PagesService } from '../events/pages/pages.service';
import { OrganizationsService } from '../tenancy/organizations/organizations.service';
import { EventStatus } from '../events/dto/update-event-seo.dto';

export interface RenderedPage {
  event: {
    id: string;
    organizationId: string;
    type: string;
    title: string;
    slug: string;
    category: string;
    status: EventStatus | string;
    publishedAt: Date | null;
    qrCodeUrl: string | null;
    organization: {
      name: string;
      logoUrl: string | null;
    };
  };

  pages: {
    id: string;
    title: string;
    slug: string;
    isHome: boolean;
    showInNav: boolean;
  }[];

  currentPageId?: string;
  currentPageSlug?: string;

  template: {
    id: string;
    name: string;
    slug: string;
  } | null;

  theme: {
    id: string;
    name: string;
    tokens: Record<string, any>;
  } | null;

  sections: {
    id: string;
    type: string;
    order: number;
    content: Record<string, any>;
    visible?: boolean;
    pageId?: string | null;
  }[];
}

@Injectable()
export class WebsiteBuilderService {
  constructor(
    private readonly eventsService: EventsService,
    private readonly templatesService: TemplatesService,
    private readonly themesService: ThemesService,
    private readonly sectionsService: SectionsService,
    private readonly pagesService: PagesService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /*
   * =========================================================
   * SAFE TEMPLATE
   * =========================================================
   */

  private async safeFindTemplate(
    templateId: string | undefined | null,
  ) {
    if (!templateId) {
      return null;
    }

    try {
      return await this.templatesService.findByIdOrThrow(
        templateId,
      );
    } catch {
      return null;
    }
  }

  /*
   * =========================================================
   * SAFE THEME
   * =========================================================
   */

  private async safeFindTheme(
    themeId: string | undefined | null,
  ) {
    if (!themeId) {
      return null;
    }

    try {
      return await this.themesService.findByIdOrThrow(
        themeId,
      );
    } catch {
      return null;
    }
  }

  /*
   * =========================================================
   * BUILD RENDER PAYLOAD
   * =========================================================
   */

  private buildRenderPayload(
    event: any,
    organization: any,
    pages: any[],
    targetPage: any,
    template: any,
    theme: any,
    sections: any[],
    isPreview = false,
  ): RenderedPage {
    const targetPageId = String(
      targetPage.id ??
        targetPage._id?.toString(),
    );

    const targetPageSlug =
      targetPage.slug ?? undefined;

    const processedSections = sections
      .filter(
        (section) =>
          isPreview ||
          section.visible !== false,
      )
      .sort(
        (a, b) =>
          (a.order ?? 0) -
          (b.order ?? 0),
      )
      .map((section) => ({
        id:
          section.id ??
          section._id?.toString(),

        type: section.type,

        order:
          section.order ?? 0,

        content:
          section.content ?? {},

        pageId:
          section.pageId
            ? String(section.pageId)
            : null,

        ...(isPreview
          ? {
              visible:
                section.visible !== false,
            }
          : {}),
      }));

    return {
      event: {
        id:
          event.id ??
          event._id?.toString(),

        organizationId:
          event.organizationId?.toString(),

        type:
          event.type ?? 'general',

        title:
          event.title,

        slug:
          event.slug,

        category:
          event.category ??
          'General',

        status:
          event.status,

        publishedAt:
          event.publishedAt ??
          null,

        qrCodeUrl:
          event.qrCodeUrl ??
          null,

        organization: {
          name:
            organization.name,

          logoUrl:
            organization.logoUrl ??
            null,
        },
      },

      pages: pages.map((page) => ({
        id:
          page.id ??
          page._id?.toString(),

        title:
          page.title,

        slug:
          page.slug,

        isHome:
          page.isHome === true,

        showInNav:
          page.showInNav !== false,
      })),

      currentPageId:
        targetPageId,

      currentPageSlug:
        targetPageSlug,

      template: template
        ? {
            id:
              template.id ??
              template._id?.toString(),

            name:
              template.name,

            slug:
              template.slug,
          }
        : null,

      theme: theme
        ? {
            id:
              theme.id ??
              theme._id?.toString(),

            name:
              theme.name,

            tokens:
              theme.tokens ?? {},
          }
        : null,

      sections:
        processedSections,
    };
  }

  /*
   * =========================================================
   * PUBLIC PUBLISHED PAGE
   * =========================================================
   */

  async renderPublishedPage(
    slug: string,
    pageSlug?: string,
  ): Promise<RenderedPage> {
    const event =
      await this.eventsService.findPublishedBySlug(slug);

    if (!event) {
      throw new NotFoundException(
        `Published event with slug '${slug}' not found`,
      );
    }

    const organizationId =
      event.organizationId.toString();

    const eventId =
      event.id?.toString() ??
      event._id?.toString();

    if (!eventId) {
      throw new NotFoundException(
        'Published event has no valid ID',
      );
    }

    /*
     * ----------------------------------------------------------
     * LOAD REAL PAGES
     * ----------------------------------------------------------
     */

    let pages: any[] = [];

    try {
      pages =
        await this.pagesService.listForEvent(
          eventId,
          organizationId,
        );
    } catch {
      pages = [];
    }

    /*
     * ----------------------------------------------------------
     * NORMAL PAGE FLOW
     * ----------------------------------------------------------
     */

    if (pages.length > 0) {
      let page: any = null;

      try {
        page =
          await this.pagesService.resolvePublic(
            eventId,
            pageSlug ?? '',
          );
      } catch {
        page = null;
      }

      if (!page) {
        throw new NotFoundException(
          pageSlug
            ? `Page '${pageSlug}' not found`
            : 'Home page not found',
        );
      }

      const pageId =
        page.id?.toString() ??
        page._id?.toString();

      if (!pageId) {
        throw new NotFoundException(
          'Target page has no valid ID',
        );
      }

      const [
        organization,
        template,
        theme,
        sections,
      ] = await Promise.all([
        this.organizationsService.findByIdOrThrow(
          organizationId,
        ),

        this.safeFindTemplate(
          event.templateId?.toString(),
        ),

        this.safeFindTheme(
          event.themeId?.toString(),
        ),

        this.sectionsService.listForEvent(
          organizationId,
          eventId,
          pageId,
        ),
      ]);

      return this.buildRenderPayload(
        event,
        organization,
        pages,
        page,
        template,
        theme,
        sections,
        false,
      );
    }

    /*
     * ----------------------------------------------------------
     * LEGACY / RECONSTRUCTED PAGE FALLBACK
     * ----------------------------------------------------------
     *
     * Some existing events were created before Page documents
     * were persisted.
     *
     * Their sections still contain pageId, so we reconstruct the
     * home page from those sections.
     */

    const allSections =
      await this.sectionsService.listForEvent(
        organizationId,
        eventId,
      );

    if (
      !allSections ||
      allSections.length === 0
    ) {
      throw new NotFoundException(
        'Published event has no pages or sections',
      );
    }

    /*
     * Use the pageId stored on the sections as the
     * reconstructed home page ID.
     */

    const reconstructedPageId =
      allSections.find(
        (section) => section.pageId,
      )?.pageId?.toString() ??
      `home-${eventId}`;

    /*
     * If a page slug was supplied, this legacy event cannot
     * reliably resolve subpages because there are no Page
     * documents. Treat the reconstructed page as home.
     */

    if (pageSlug) {
      throw new NotFoundException(
        `Page '${pageSlug}' not found`,
      );
    }

    const reconstructedPage = {
      id: reconstructedPageId,
      title: 'Home',
      slug: '',
      isHome: true,
      showInNav: true,
    };

    const reconstructedPages = [
      reconstructedPage,
    ];

    /*
     * Only render sections belonging to the reconstructed page,
     * or fallback to all sections if none match the reconstructed ID.
     */

    let homeSections =
      allSections.filter(
        (section) =>
          section.pageId?.toString() ===
          reconstructedPageId,
      );

    if (homeSections.length === 0) {
      homeSections = allSections;
    }

    const [
      organization,
      template,
      theme,
    ] = await Promise.all([
      this.organizationsService.findByIdOrThrow(
        organizationId,
      ),

      this.safeFindTemplate(
        event.templateId?.toString(),
      ),

      this.safeFindTheme(
        event.themeId?.toString(),
      ),
    ]);

    return this.buildRenderPayload(
      event,
      organization,
      reconstructedPages,
      reconstructedPage,
      template,
      theme,
      homeSections,
      false,
    );
  }

  /*
   * =========================================================
   * OWNER PREVIEW
   * =========================================================
   */

  async renderPreview(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<RenderedPage> {
    const event =
      await this.eventsService.findByIdForTenantOrThrow(
        eventId,
        organizationId,
      );

    const pages =
      await this.pagesService.listForEvent(
        eventId,
        organizationId,
      );

    if (
      !pages ||
      pages.length === 0
    ) {
      throw new NotFoundException(
        'Event has no pages for preview',
      );
    }

    let targetPage: any;

    if (pageId?.trim()) {
      const requested =
        pageId.trim();

      targetPage =
        pages.find(
          (page) =>
            String(
              page.id ??
                page._id ??
                '',
            ) === requested ||
            String(
              page.slug ?? '',
            ).toLowerCase() ===
              requested.toLowerCase(),
        );
    } else {
      targetPage =
        pages.find(
          (page) =>
            page.isHome === true,
        ) ?? pages[0];
    }

    if (!targetPage) {
      throw new NotFoundException(
        pageId
          ? `Target page '${pageId}' not found for preview`
          : 'Home page not found for preview',
      );
    }

    const targetPageId =
      String(
        targetPage.id ??
          targetPage._id,
      );

    const [
      organization,
      template,
      theme,
      sections,
    ] = await Promise.all([
      this.organizationsService.findByIdOrThrow(
        organizationId,
      ),

      this.safeFindTemplate(
        event.templateId?.toString(),
      ),

      this.safeFindTheme(
        event.themeId?.toString(),
      ),

      this.sectionsService.listForEvent(
        organizationId,
        eventId,
        targetPageId,
      ),
    ]);

    return this.buildRenderPayload(
      event,
      organization,
      pages,
      targetPage,
      template,
      theme,
      sections,
      true,
    );
  }

  /*
   * =========================================================
   * PUBLISH
   * =========================================================
   */

  async publishEvent(
    organizationId: string,
    eventId: string,
  ) {
    const event =
      await this.eventsService.findByIdForTenantOrThrow(
        eventId,
        organizationId,
      );

    if (
      event.status ===
      EventStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Event is already published',
      );
    }

    const pages =
      await this.pagesService.listForEvent(
        eventId,
        organizationId,
      );

    if (
      !pages ||
      pages.length === 0
    ) {
      throw new BadRequestException(
        'Cannot publish an event without a page.',
      );
    }

    const homePage =
      pages.find(
        (page) =>
          page.isHome === true,
      );

    if (!homePage) {
      throw new BadRequestException(
        'Cannot publish an event without a home page.',
      );
    }

    return this.eventsService.update(
      organizationId,
      eventId,
      {
        status:
          EventStatus.PUBLISHED,
      } as any,
    );
  }

  /*
   * =========================================================
   * UNPUBLISH
   * =========================================================
   */

  async unpublishEvent(
    organizationId: string,
    eventId: string,
  ) {
    const event =
      await this.eventsService.findByIdForTenantOrThrow(
        eventId,
        organizationId,
      );

    if (
      event.status !==
      EventStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Only published events can be reverted to draft mode',
      );
    }

    return this.eventsService.update(
      organizationId,
      eventId,
      {
        status:
          EventStatus.DRAFT,
      } as any,
    );
  }

  /*
   * =========================================================
   * ARCHIVE
   * =========================================================
   */

  async archiveEvent(
    organizationId: string,
    eventId: string,
  ) {
    await this.eventsService.findByIdForTenantOrThrow(
      eventId,
      organizationId,
    );

    return this.eventsService.update(
      organizationId,
      eventId,
      {
        status:
          EventStatus.ARCHIVED,
      } as any,
    );
  }
}