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

  async create(
    data: Record<string, any>,
  ): Promise<SectionDocument> {
    const document = new this.sectionModel({
      ...data,
      organizationId: new Types.ObjectId(
        data.organizationId,
      ),
      eventId: new Types.ObjectId(
        data.eventId,
      ),
      pageId: data.pageId
        ? new Types.ObjectId(data.pageId)
        : null,
      deletedAt: data.deletedAt ?? null,
      version: data.version ?? 0,
    });

    return document.save();
  }

  // =========================================================
  // ACTIVE SECTION FILTER
  // =========================================================

  private getActiveSectionFilter() {
    return {
      $or: [
        {
          deletedAt: null,
        },
        {
          deletedAt: {
            $exists: false,
          },
        },
      ],
    };
  }

  // =========================================================
  // FIND BY ID
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

        ...this.getActiveSectionFilter(),
      })
      .exec();
  }

  // =========================================================
  // FIND BY EVENT
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

    const validEventId =
      new Types.ObjectId(eventId);

    const validOrganizationId =
      new Types.ObjectId(
        organizationId,
      );

    const sections =
      await this.sectionModel
        .find({
          organizationId:
            validOrganizationId,

          eventId:
            validEventId,

          ...this.getActiveSectionFilter(),
        })
        .sort({
          pageId: 1,
          order: 1,
          createdAt: 1,
        })
        .exec();

    return sections;
  }

  // =========================================================
  // CREATE MANY
  // =========================================================

  async createMany(
    sections: Record<string, any>[],
  ): Promise<SectionDocument[]> {
    if (!sections.length) {
      return [];
    }

    const preparedSections =
      sections.map((section) => {
        if (
          !section.organizationId ||
          !Types.ObjectId.isValid(
            section.organizationId,
          )
        ) {
          throw new Error(
            `Invalid organizationId for section ${section.type ?? ''}`,
          );
        }

        if (
          !section.eventId ||
          !Types.ObjectId.isValid(
            section.eventId,
          )
        ) {
          throw new Error(
            `Invalid eventId for section ${section.type ?? ''}`,
          );
        }

        if (
          section.pageId !== null &&
          section.pageId !== undefined &&
          !Types.ObjectId.isValid(
            section.pageId,
          )
        ) {
          throw new Error(
            `Invalid pageId for section ${section.type ?? ''}`,
          );
        }

        return {
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
            section.deletedAt ??
            null,

          version:
            section.version ??
            0,
        };
      });

    const created =
      await this.sectionModel.insertMany(
        preparedSections,
      );

    return created as unknown as SectionDocument[];
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

          ...this.getActiveSectionFilter(),
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

    if (!orderedIds.length) {
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

              ...this.getActiveSectionFilter(),
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

    if (!bulkOps.length) {
      return;
    }

    await this.sectionModel.bulkWrite(
      bulkOps,
    );
  }
}



// import {
//   Injectable,
// } from '@nestjs/common';

// import {
//   InjectModel,
// } from '@nestjs/mongoose';

// import {
//   Model,
//   Types,
// } from 'mongoose';

// import {
//   BaseTenantRepository,
// } from '../../../../common/base/base-tenant.repository';

// import {
//   Section,
//   SectionDocument,
// } from '../schemas/section.schema';

// import {
//   ISectionRepository,
// } from '../interfaces/section-repository.interface';

// @Injectable()
// export class MongooseSectionRepository
//   extends BaseTenantRepository<SectionDocument>
//   implements ISectionRepository
// {
//   constructor(
//     @InjectModel(Section.name)
//     private readonly sectionModel:
//       Model<SectionDocument>,
//   ) {
//     super(sectionModel);
//   }

//   // =========================================================
//   // FIND BY ID + TENANT + EVENT
//   // =========================================================

//   async findByIdForTenantAndEvent(
//     id: string,
//     organizationId: string,
//     eventId: string,
//   ): Promise<SectionDocument | null> {
//     if (
//       !Types.ObjectId.isValid(id) ||
//       !Types.ObjectId.isValid(
//         organizationId,
//       ) ||
//       !Types.ObjectId.isValid(eventId)
//     ) {
//       return null;
//     }

//     return this.sectionModel
//       .findOne({
//         _id:
//           new Types.ObjectId(id),

//         organizationId:
//           new Types.ObjectId(
//             organizationId,
//           ),

//         eventId:
//           new Types.ObjectId(
//             eventId,
//           ),

//         deletedAt: null,
//       })
//       .exec();
//   }

//   // =========================================================
//   // FIND ALL FOR EVENT + TENANT
//   // =========================================================

//   async findByEvent(
//     eventId: string,
//     organizationId: string,
//   ): Promise<SectionDocument[]> {
//     if (
//       !Types.ObjectId.isValid(eventId) ||
//       !Types.ObjectId.isValid(
//         organizationId,
//       )
//     ) {
//       return [];
//     }

//     const sections = await this.sectionModel
//       .find({
//         eventId:
//           new Types.ObjectId(
//             eventId,
//           ),

//         organizationId:
//           new Types.ObjectId(
//             organizationId,
//           ),

//         deletedAt: null,
//       })
//       .sort({
//         order: 1,
//       })
//       .exec();

//     if (sections.length > 0) {
//       return sections;
//     }

//     // Keep reads compatible with documents created before the explicit
//     // ObjectId query was introduced.
//     return this.findMany({
//       eventId: this.toObjectId(eventId),
//       organizationId: this.toObjectId(organizationId),
//     } as any);
//   }

//   // =========================================================
//   // CREATE MANY
//   // =========================================================

//   async createMany(
//     sections: Record<string, any>[],
//   ): Promise<SectionDocument[]> {
//     const preparedSections =
//       sections.map((section) => ({
//         ...section,

//         organizationId:
//           new Types.ObjectId(
//             section.organizationId,
//           ),

//         eventId:
//           new Types.ObjectId(
//             section.eventId,
//           ),

//         pageId:
//           section.pageId
//             ? new Types.ObjectId(
//                 section.pageId,
//               )
//             : null,

//         deletedAt:
//           null,

//         version:
//           0,
//       }));

//     return this.sectionModel.insertMany(
//       preparedSections,
//     ) as unknown as SectionDocument[];
//   }

//   // =========================================================
//   // UPDATE
//   // =========================================================

//   async updateById(
//     id: string,
//     data: Record<string, any>,
//   ): Promise<SectionDocument | null> {
//     if (
//       !Types.ObjectId.isValid(id)
//     ) {
//       return null;
//     }

//     const updateData = {
//       ...data,
//     };

//     if (
//       updateData.pageId !== undefined
//     ) {
//       updateData.pageId =
//         updateData.pageId
//           ? new Types.ObjectId(
//               updateData.pageId,
//             )
//           : null;
//     }

//     return this.sectionModel
//       .findOneAndUpdate(
//         {
//           _id:
//             new Types.ObjectId(id),

//           deletedAt: null,
//         },
//         {
//           $set: updateData,

//           $inc: {
//             version: 1,
//           },
//         },
//         {
//           new: true,
//         },
//       )
//       .exec();
//   }

//   // =========================================================
//   // REORDER
//   // =========================================================

//   async reorder(
//     organizationId: string,
//     eventId: string,
//     orderedIds: string[],
//   ): Promise<void> {
//     if (
//       !Types.ObjectId.isValid(
//         organizationId,
//       ) ||
//       !Types.ObjectId.isValid(
//         eventId,
//       )
//     ) {
//       return;
//     }

//     const validOrganizationId =
//       new Types.ObjectId(
//         organizationId,
//       );

//     const validEventId =
//       new Types.ObjectId(
//         eventId,
//       );

//     const bulkOps =
//       orderedIds
//         .filter((id) =>
//           Types.ObjectId.isValid(id),
//         )
//         .map((id, index) => ({
//           updateOne: {
//             filter: {
//               _id:
//                 new Types.ObjectId(id),

//               organizationId:
//                 validOrganizationId,

//               eventId:
//                 validEventId,

//               deletedAt: null,
//             },

//             update: {
//               $set: {
//                 order: index,
//               },

//               $inc: {
//                 version: 1,
//               },
//             },
//           },
//         }));

//     if (
//       bulkOps.length === 0
//     ) {
//       return;
//     }

//     await this.sectionModel.bulkWrite(
//       bulkOps,
//     );
//   }
// }