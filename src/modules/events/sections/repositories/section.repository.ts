import {
  Injectable,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  BaseTenantRepository,
} from '../../../../common/base/base-tenant.repository';

import {
  Section,
  SectionDocument,
} from '../schemas/section.schema';

import {
  ISectionRepository,
} from '../interfaces/section-repository.interface';

@Injectable()
export class MongooseSectionRepository
  extends BaseTenantRepository<SectionDocument>
  implements ISectionRepository
{
  constructor(
    @InjectModel(Section.name)
    private readonly sectionModel:
      Model<SectionDocument>,
  ) {
    super(sectionModel);
  }

  // =========================================================
  // FIND BY ID + TENANT + EVENT
  // =========================================================

  async findByIdForTenantAndEvent(
    id: string,
    organizationId: string,
    eventId: string,
  ): Promise<SectionDocument | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(
        organizationId,
      ) ||
      !Types.ObjectId.isValid(eventId)
    ) {
      return null;
    }

    return this.sectionModel
      .findOne({
        _id:
          new Types.ObjectId(id),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        eventId:
          new Types.ObjectId(
            eventId,
          ),

        deletedAt: null,
      })
      .exec();
  }

  // =========================================================
  // FIND ALL FOR EVENT + TENANT
  // =========================================================

  async findByEvent(
    eventId: string,
    organizationId: string,
  ): Promise<SectionDocument[]> {
    if (
      !Types.ObjectId.isValid(eventId) ||
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return [];
    }

    return this.sectionModel
      .find({
        eventId:
          new Types.ObjectId(
            eventId,
          ),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        deletedAt: null,
      })
      .sort({
        order: 1,
      })
      .exec();
  }

  // =========================================================
  // CREATE MANY
  // =========================================================

  async createMany(
    sections: Record<string, any>[],
  ): Promise<SectionDocument[]> {
    const preparedSections =
      sections.map((section) => ({
        ...section,

        organizationId:
          new Types.ObjectId(
            section.organizationId,
          ),

        eventId:
          new Types.ObjectId(
            section.eventId,
          ),

        pageId:
          section.pageId
            ? new Types.ObjectId(
                section.pageId,
              )
            : null,

        deletedAt:
          null,

        version:
          0,
      }));

    return this.sectionModel.insertMany(
      preparedSections,
    ) as unknown as SectionDocument[];
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async updateById(
    id: string,
    data: Record<string, any>,
  ): Promise<SectionDocument | null> {
    if (
      !Types.ObjectId.isValid(id)
    ) {
      return null;
    }

    const updateData = {
      ...data,
    };

    if (
      updateData.pageId !== undefined
    ) {
      updateData.pageId =
        updateData.pageId
          ? new Types.ObjectId(
              updateData.pageId,
            )
          : null;
    }

    return this.sectionModel
      .findOneAndUpdate(
        {
          _id:
            new Types.ObjectId(id),

          deletedAt: null,
        },
        {
          $set: updateData,

          $inc: {
            version: 1,
          },
        },
        {
          new: true,
        },
      )
      .exec();
  }

  // =========================================================
  // REORDER
  // =========================================================

  async reorder(
    organizationId: string,
    eventId: string,
    orderedIds: string[],
  ): Promise<void> {
    if (
      !Types.ObjectId.isValid(
        organizationId,
      ) ||
      !Types.ObjectId.isValid(
        eventId,
      )
    ) {
      return;
    }

    const validOrganizationId =
      new Types.ObjectId(
        organizationId,
      );

    const validEventId =
      new Types.ObjectId(
        eventId,
      );

    const bulkOps =
      orderedIds
        .filter((id) =>
          Types.ObjectId.isValid(id),
        )
        .map((id, index) => ({
          updateOne: {
            filter: {
              _id:
                new Types.ObjectId(id),

              organizationId:
                validOrganizationId,

              eventId:
                validEventId,

              deletedAt: null,
            },

            update: {
              $set: {
                order: index,
              },

              $inc: {
                version: 1,
              },
            },
          },
        }));

    if (
      bulkOps.length === 0
    ) {
      return;
    }

    await this.sectionModel.bulkWrite(
      bulkOps,
    );
  }
}