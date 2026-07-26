import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

// Separate interface type from injection token for isolatedModules compatibility
import type { IAnalyticsRepository } from './interfaces/analytics-repository.interface';
import { ANALYTICS_REPOSITORY } from './interfaces/analytics-repository.interface';

import { AnalyticsEventType } from './schemas/analytics-event.schema';
import { EventPublishedDomainEvent } from '../events/events.domain-events';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPOSITORY) private analyticsRepo: IAnalyticsRepository,
  ) {}

  track(
    organizationId: string,
    eventId: string,
    type: AnalyticsEventType,
    meta?: Record<string, any>,
  ) {
    return this.analyticsRepo.record(organizationId, eventId, type, meta);
  }

  @OnEvent('event.published')
  async handleEventPublished(payload: EventPublishedDomainEvent) {
    await this.analyticsRepo.record(
      payload.organizationId,
      payload.eventId,
      AnalyticsEventType.EVENT_PUBLISHED,
      { publishedByUserId: payload.publishedByUserId },
    );
  }

  async summary(eventId: string) {
    const counts = await this.analyticsRepo.countByType(eventId);
    return {
      pageViews: counts[AnalyticsEventType.PAGE_VIEW] || 0,
      qrScans: counts[AnalyticsEventType.QR_SCAN] || 0,
      galleryViews: counts[AnalyticsEventType.GALLERY_VIEW] || 0,
      livestreamClicks: counts[AnalyticsEventType.LIVESTREAM_CLICK] || 0,
    };
  }
}