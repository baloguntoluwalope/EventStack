import { AnalyticsEventDocument, AnalyticsEventType } from '../schemas/analytics-event.schema';

export interface IAnalyticsRepository {
  record(
    organizationId: string,
    eventId: string,
    type: AnalyticsEventType,
    meta?: Record<string, any>,
  ): Promise<AnalyticsEventDocument>;
  countByType(eventId: string): Promise<Record<string, number>>;
}

export const ANALYTICS_REPOSITORY = 'ANALYTICS_REPOSITORY';