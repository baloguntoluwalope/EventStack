import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Event, EventDocument } from '../schemas/event.schema';
import { IEventRepository } from '../interfaces/event-repository.interface';

@Injectable()
export class MongooseEventRepository
  extends BaseTenantRepository<EventDocument>
  implements IEventRepository
{
  constructor(@InjectModel(Event.name) model: Model<EventDocument>) {
    super(model);
  }

  /**
   * Deliberately global, not tenant-scoped — slugs are unique across the
   * whole platform (public URL namespace), not per-organization.
   */
  findBySlug(slug: string) {
    return this.findOne({ slug } as any);
  }

  findAllPublished() {
    return this.model.find({ status: 'published', deletedAt: null }).exec();
  }
}