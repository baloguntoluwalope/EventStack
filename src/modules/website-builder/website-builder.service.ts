import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { TemplatesService } from '../events/templates/templates.service';
import { ThemesService } from '../events/themes/themes.service';
import { SectionsService } from '../events/sections/sections.service';
import { OrganizationsService } from '../tenancy/organizations/organizations.service';
import { EventStatus } from '../events/dto/update-event-seo.dto';

export interface RenderedPage {
  event: {
    id: string;
    organizationId: string;
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
  }[];
}

@Injectable()
export class WebsiteBuilderService {
  constructor(
    private readonly eventsService: EventsService,
    private readonly templatesService: TemplatesService,
    private readonly themesService: ThemesService,
    private readonly sectionsService: SectionsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private async safeFindTemplate(templateId: string | undefined | null) {
    if (!templateId) return null;
    try {
      return await this.templatesService.findByIdOrThrow(templateId);
    } catch {
      return null;
    }
  }

  private async safeFindTheme(themeId: string | undefined | null) {
    if (!themeId) return null;
    try {
      return await this.themesService.findByIdOrThrow(themeId);
    } catch {
      return null;
    }
  }

  private buildRenderPayload(
    event: any,
    organization: any,
    template: any,
    theme: any,
    sections: any[],
    isPreview = false,
  ): RenderedPage {
    const processedSections = sections
      .filter((s) => isPreview || s.visible)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        type: s.type,
        order: s.order,
        content: s.content,
        ...(isPreview && { visible: s.visible }),
      }));

    return {
      event: {
        id: event.id,
        organizationId: event.organizationId.toString(),
        title: event.title,
        slug: event.slug,
        category: event.category ?? 'General',
        status: event.status,
        publishedAt: event.publishedAt ?? null,
        qrCodeUrl: event.qrCodeUrl ?? null,
        organization: {
          name: organization.name,
          logoUrl: organization.logoUrl ?? null,
        },
      },
      template: template ? { id: template.id, name: template.name, slug: template.slug } : null,
      theme: theme ? { id: theme.id, name: theme.name, tokens: theme.tokens } : null,
      sections: processedSections,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                              Rendering Methods                             */
  /* -------------------------------------------------------------------------- */

  async renderPublishedPage(slug: string): Promise<RenderedPage> {
    const event = await this.eventsService.findPublishedBySlug(slug);
    if (!event) {
      throw new NotFoundException(`Published event with slug '${slug}' not found`);
    }

    const [organization, template, theme, sections] = await Promise.all([
      this.organizationsService.findByIdOrThrow(event.organizationId.toString()),
      this.safeFindTemplate(event.templateId?.toString()),
      this.safeFindTheme(event.themeId?.toString()),
      this.sectionsService.listForEvent(event.organizationId.toString(), event.id),
    ]);

    return this.buildRenderPayload(event, organization, template, theme, sections, false);
  }

  async renderPreview(organizationId: string, eventId: string): Promise<RenderedPage> {
    const event = await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    const [organization, template, theme, sections] = await Promise.all([
      this.organizationsService.findByIdOrThrow(organizationId),
      this.safeFindTemplate(event.templateId?.toString()),
      this.safeFindTheme(event.themeId?.toString()),
      this.sectionsService.listForEvent(organizationId, eventId),
    ]);

    return this.buildRenderPayload(event, organization, template, theme, sections, true);
  }

  /* -------------------------------------------------------------------------- */
  /*                         Lifecycle & Status Actions                         */
  /* -------------------------------------------------------------------------- */

  async publishEvent(organizationId: string, eventId: string) {
    const event = await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    if (event.status === EventStatus.PUBLISHED) {
      throw new BadRequestException('Event is already published');
    }

    return this.eventsService.update(organizationId, eventId, {
      status: EventStatus.PUBLISHED,
    } as any);
  }

  async unpublishEvent(organizationId: string, eventId: string) {
    const event = await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Only published events can be reverted to draft mode');
    }

    return this.eventsService.update(organizationId, eventId, {
      status: EventStatus.DRAFT,
    } as any);
  }

  async archiveEvent(organizationId: string, eventId: string) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    return this.eventsService.update(organizationId, eventId, {
      status: EventStatus.ARCHIVED,
    } as any);
  }
}