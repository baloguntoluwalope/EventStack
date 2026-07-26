import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AnalyticsEvent, AnalyticsEventDocument, AnalyticsEventType,
} from '../schemas/analytics-event.schema';
import { IAnalyticsRepository } from '../interfaces/analytics-repository.interface';

@Injectable()
export class MongooseAnalyticsRepository implements IAnalyticsRepository {
  constructor(@InjectModel(AnalyticsEvent.name) private model: Model<AnalyticsEventDocument>) {}

  record(organizationId: string, eventId: string, type: AnalyticsEventType, meta: Record<string, any> = {}) {
    return this.model.create({ organizationId, eventId, type, meta } as any);
  }

  async countByType(eventId: string): Promise<Record<string, number>> {
    const results = await this.model.aggregate([
      { $match: { eventId: new Types.ObjectId(eventId), deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const summary: Record<string, number> = {};
    for (const r of results) summary[r._id] = r.count;
    return summary;
  }
}