import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Media, MediaDocument } from '../schemas/media.schema';
import { IMediaRepository } from '../interfaces/media-repository.interface';

@Injectable()
export class MongooseMediaRepository
  extends BaseTenantRepository<MediaDocument>
  implements IMediaRepository
{
  constructor(@InjectModel(Media.name) model: Model<MediaDocument>) {
    super(model);
  }

  findByEvent(eventId: string) {
    return this.model.find({ eventId, deletedAt: null }).sort({ createdAt: -1 }).exec();
  }
}