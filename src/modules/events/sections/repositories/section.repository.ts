import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
import { Section, SectionDocument } from '../schemas/section.schema';
import { ISectionRepository } from '../interfaces/section-repository.interface';

@Injectable()
export class MongooseSectionRepository
  extends BaseTenantRepository<SectionDocument>
  implements ISectionRepository
{
  constructor(@InjectModel(Section.name) private readonly sectionModel: Model<SectionDocument>) {
    super(sectionModel);
  }

  /**
   * Finds a section explicitly scoped to both tenant organization AND parent event.
   */
  async findByIdForTenantAndEvent(
    id: string,
    organizationId: string,
    eventId: string,
  ): Promise<SectionDocument | null> {
    return this.sectionModel
      .findOne({
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        eventId: new Types.ObjectId(eventId),
        deletedAt: null,
      })
      .exec();
  }

  async findByEvent(eventId: string): Promise<SectionDocument[]> {
    return this.sectionModel
      .find({
        eventId: new Types.ObjectId(eventId),
        deletedAt: null,
      })
      .sort({ order: 1 })
      .exec();
  }

  async createMany(sections: Record<string, any>[]): Promise<SectionDocument[]> {
    const preparedSections = sections.map((sec) => ({
      ...sec,
      organizationId: new Types.ObjectId(sec.organizationId),
      eventId: new Types.ObjectId(sec.eventId),
    }));

    return this.sectionModel.insertMany(preparedSections) as unknown as SectionDocument[];
  }

  async reorder(eventId: string, orderedIds: string[]): Promise<void> {
    const validEventId = new Types.ObjectId(eventId);

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(id),
          eventId: validEventId,
          deletedAt: null,
        },
        update: { $set: { order: index } },
      },
    }));

    if (bulkOps.length > 0) {
      await this.sectionModel.bulkWrite(bulkOps);
    }
  }
}