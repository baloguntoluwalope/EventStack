import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
import { Section, SectionDocument } from '../schemas/section.schema';
import { ISectionRepository } from '../interfaces/section-repository.interface';

@Injectable()
export class MongooseSectionRepository
  extends BaseTenantRepository<SectionDocument>
  implements ISectionRepository
{
  constructor(@InjectModel(Section.name) model: Model<SectionDocument>) {
    super(model);
  }

  findByEvent(eventId: string) {
    return this.model.find({ eventId, deletedAt: null }).sort({ order: 1 }).exec();
  }

  async reorder(eventId: string, orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) =>
        this.model.updateOne({ _id: id, eventId, deletedAt: null }, { order: index }).exec(),
      ),
    );
  }
}