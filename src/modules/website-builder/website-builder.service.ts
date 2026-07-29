import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { TemplatesService } from '../events/templates/templates.service';
import { ThemesService } from '../events/themes/themes.service';
import { SectionsService } from '../events/sections/sections.service';

export interface RenderedPage {
  event: {
    id: string;
    organizationId: string;
    title: string;
    slug: string;
    category: string;
    status: string;
    publishedAt: Date | null;
    qrCodeUrl: string | null;
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
  }[];
}

@Injectable()
export class WebsiteBuilderService {
  constructor(
    private eventsService: EventsService,
    private templatesService: TemplatesService,
    private themesService: ThemesService,
    private sectionsService: SectionsService,
  ) {}

  /**
   * Composes the full render payload for a published, public event page.
   * This is the "Renderer" step of the architecture doc's pipeline
   * (Event → Template → Theme → Sections → SEO → Renderer). SEO metadata
   * is deliberately NOT included here yet — that's the SEO module, Phase 4,
   * which will wrap this output rather than this service reaching into SEO.
   */
  async renderPublishedPage(slug: string): Promise<RenderedPage> {
    const event = await this.eventsService.findPublishedBySlug(slug);

    const [template, theme, sections] = await Promise.all([
      event.templateId ? this.templatesService.findByIdOrThrow(event.templateId.toString()) : null,
      event.themeId ? this.themesService.findByIdOrThrow(event.themeId.toString()) : null,
      this.sectionsService.listForEvent(event.organizationId.toString(), event.id),
    ]);

    return {
      event: {
        id: event.id,
        organizationId: event.organizationId.toString(),
        title: event.title,
        slug: event.slug,
        category: event.category,
        status: event.status,
        publishedAt: event.publishedAt,
        qrCodeUrl: event.qrCodeUrl,
      },
      template: template ? { id: template.id, name: template.name, slug: template.slug } : null,
      theme: theme ? { id: theme.id, name: theme.name, tokens: theme.tokens } : null,
      sections: sections
        .filter((s) => s.visible)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, type: s.type, order: s.order, content: s.content })),
    };
  }

  /**
   * Owner-side preview: same composition, but works on drafts too (no
   * published-status requirement) and doesn't filter hidden sections —
   * an editor previewing their work needs to see everything, visible or not.
   */
  async renderPreview(organizationId: string, eventId: string): Promise<RenderedPage> {
    const event = await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    const [template, theme, sections] = await Promise.all([
      event.templateId ? this.templatesService.findByIdOrThrow(event.templateId.toString()) : null,
      event.themeId ? this.themesService.findByIdOrThrow(event.themeId.toString()) : null,
      this.sectionsService.listForEvent(organizationId, eventId),
    ]);

    return {
      event: {
        id: event.id,
        organizationId: event.organizationId.toString(),
        title: event.title,
        slug: event.slug,
        category: event.category,
        status: event.status,
        publishedAt: event.publishedAt,
        qrCodeUrl: event.qrCodeUrl,
      },
      template: template ? { id: template.id, name: template.name, slug: template.slug } : null,
      theme: theme ? { id: theme.id, name: theme.name, tokens: theme.tokens } : null,
      sections: sections
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ id: s.id, type: s.type, order: s.order, content: s.content })),
    };
  }
}