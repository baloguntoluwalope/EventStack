import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Event, EventDocument } from '../schemas/event.schema';
import { IEventRepository } from '../interfaces/event-repository.interface';
import { EventStatus } from '../../../common/constants/event-status.constants';

@Injectable()
export class MongooseEventRepository
  extends BaseTenantRepository<EventDocument>
  implements IEventRepository
{
  constructor(@InjectModel(Event.name) model: Model<EventDocument>) {
    super(model);
  }

  /**
   * Slugs are globally unique across the platform public URL space.
   */
  async findBySlug(slug: string): Promise<EventDocument | null> {
    return this.findOne({ slug, deletedAt: null });
  }

  async findAllPublished(): Promise<EventDocument[]> {
    return this.model
      .find({ status: EventStatus.PUBLISHED, deletedAt: null })
      .exec();
  }
}