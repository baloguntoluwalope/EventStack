import { Injectable } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { SectionsService } from '../events/sections/sections.service';

export interface SeoPayload {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  canonicalUrl: string;
  schemaOrgJson: Record<string, any>;
}

@Injectable()
export class SeoService {
  constructor(
    private eventsService: EventsService,
    private sectionsService: SectionsService,
  ) {}

  private cleanUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  async generateForPublishedEvent(slug: string, rawAppUrl: string): Promise<SeoPayload> {
    const appUrl = this.cleanUrl(rawAppUrl);
    const event = await this.eventsService.findPublishedBySlug(slug);

    const organizationId =
      typeof event.organizationId === 'object' && event.organizationId !== null
        ? (event.organizationId as any)._id?.toString() || (event.organizationId as any).toString()
        : String(event.organizationId);

    const eventId = (event as any).id || (event as any)._id?.toString();

    const sections = await this.sectionsService.listForEvent(
      organizationId,
      eventId,
    );

    const metaTitle = event.metaTitle || event.title;
    const metaDescription =
      event.metaDescription || `Join us for ${event.title}. ${event.category || ''}`.trim();
    const canonicalUrl = `${appUrl}/e/${event.slug}`;

    // Best-effort startDate extraction from countdown section
    const countdownSection = sections.find((s) => s.type === 'countdown');
    const startDate = countdownSection?.content?.targetDate ?? null;

    const schemaOrgJson: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      description: metaDescription,
      url: canonicalUrl,
      eventStatus: 'https://schema.org/EventScheduled',
    };

    if (startDate) schemaOrgJson.startDate = startDate;
    if (event.ogImageUrl) schemaOrgJson.image = [event.ogImageUrl];

    return {
      metaTitle,
      metaDescription,
      ogTitle: metaTitle,
      ogDescription: metaDescription,
      ogImage: event.ogImageUrl || null,
      canonicalUrl,
      schemaOrgJson,
    };
  }

  async generateSitemap(rawAppUrl: string): Promise<string> {
    const appUrl = this.cleanUrl(rawAppUrl);
    const publishedEvents = await this.eventsService.findAllPublished();

    const urls = publishedEvents
      .map((e) => {
        const rawDate = e.publishedAt || (e as any).updatedAt;
        const lastMod = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();

        return `  <url>
    <loc>${appUrl}/e/${e.slug}</loc>
    <lastmod>${lastMod}</lastmod>
  </url>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  }

  generateRobotsTxt(rawAppUrl: string): string {
    const appUrl = this.cleanUrl(rawAppUrl);
    return `User-agent: *
Allow: /
Sitemap: ${appUrl}/sitemap.xml`;
  }
}