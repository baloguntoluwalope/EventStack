import { Injectable } from '@nestjs/common';
import {
  Model,
  Types,
} from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

import {
  BaseTenantRepository,
} from '../../../../common/base/base-tenant.repository';

import {
  TeamRegistration,
  TeamRegistrationDocument,
} from '../schemas/team-registration.schema';

import {
  ITeamRegistrationRepository,
} from '../interfaces/team-registration-repository.interface';

@Injectable()
export class MongooseTeamRegistrationRepository
  extends BaseTenantRepository<TeamRegistrationDocument>
  implements ITeamRegistrationRepository
{
  constructor(
    @InjectModel(TeamRegistration.name)
    private readonly registrationModel:
      Model<TeamRegistrationDocument>,
  ) {
    super(registrationModel);
  }

  // =========================================================
  // FIND REGISTRATIONS FOR TOURNAMENT
  // =========================================================

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<TeamRegistrationDocument[]> {
    if (
      !tournamentId ||
      !organizationId
    ) {
      return [];
    }

    if (
      !Types.ObjectId.isValid(
        tournamentId,
      )
    ) {
      console.error(
        '[TeamRegistrationRepository] Invalid tournamentId',
        tournamentId,
      );

      return [];
    }

    if (
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      console.error(
        '[TeamRegistrationRepository] Invalid organizationId',
        organizationId,
      );

      return [];
    }

    const tournamentObjectId =
      new Types.ObjectId(
        tournamentId,
      );

    const organizationObjectId =
      new Types.ObjectId(
        organizationId,
      );

    console.log(
      '[TeamRegistrationRepository] FIND TOURNAMENT REGISTRATIONS',
      {
        tournamentId,
        organizationId,
        tournamentObjectId:
          String(tournamentObjectId),
        organizationObjectId:
          String(organizationObjectId),
      },
    );

    /*
     * First inspect everything stored for this tournament.
     *
     * This makes it much easier to diagnose mismatched
     * organizationId/status/deletedAt values.
     */
    const allForTournament =
      await this.registrationModel
        .find({
          tournamentId:
            tournamentObjectId,
        })
        .exec();

    console.log(
      '[TeamRegistrationRepository] ALL REGISTRATIONS FOR TOURNAMENT',
      {
        tournamentId,
        count:
          allForTournament.length,

        registrations:
          allForTournament.map(
            (registration: any) => ({
              id:
                String(
                  registration._id,
                ),

              organizationId:
                String(
                  registration.organizationId,
                ),

              tournamentId:
                String(
                  registration.tournamentId,
                ),

              teamId:
                String(
                  registration.teamId,
                ),

              status:
                registration.status,

              deletedAt:
                registration.deletedAt,
            }),
          ),
      },
    );

    /*
     * Proper tenant + tournament lookup.
     *
     * deletedAt can be either null or absent,
     * depending on how BaseEntity/schema was created.
     */
    const registrations =
      await this.registrationModel
        .find({
          organizationId:
            organizationObjectId,

          tournamentId:
            tournamentObjectId,

          status: 'registered',

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
        })
        .sort({
          createdAt: 1,
        })
        .exec();

    console.log(
      '[TeamRegistrationRepository] FILTERED RESULT',
      {
        tournamentId,
        organizationId,
        count:
          registrations.length,

        registrations:
          registrations.map(
            (registration: any) => ({
              id:
                String(
                  registration._id,
                ),

              organizationId:
                String(
                  registration.organizationId,
                ),

              tournamentId:
                String(
                  registration.tournamentId,
                ),

              teamId:
                String(
                  registration.teamId,
                ),

              status:
                registration.status,

              deletedAt:
                registration.deletedAt,
            }),
          ),
      },
    );

    return registrations;
  }

  // =========================================================
  // FIND ONE REGISTRATION
  // =========================================================

  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<TeamRegistrationDocument | null> {
    if (
      !id ||
      !organizationId ||
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return null;
    }

    return this.registrationModel
      .findOne({
        _id:
          new Types.ObjectId(id),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

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
      })
      .exec();
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    data: Partial<TeamRegistrationDocument>,
  ): Promise<TeamRegistrationDocument> {
    const registration =
      new this.registrationModel(
        data,
      );

    const saved =
      await registration.save();

    console.log(
      '[TeamRegistrationRepository] CREATED',
      {
        id:
          String(saved._id),

        organizationId:
          String(
            saved.organizationId,
          ),

        tournamentId:
          String(
            saved.tournamentId,
          ),

        teamId:
          String(
            saved.teamId,
          ),

        status:
          saved.status,

        deletedAt:
          saved.deletedAt,
      },
    );

    return saved;
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async updateById(
    id: string,
    data: Partial<TeamRegistrationDocument>,
  ): Promise<TeamRegistrationDocument | null> {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      return null;
    }

    return this.registrationModel
      .findOneAndUpdate(
        {
          _id:
            new Types.ObjectId(id),

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
        },
        {
          $set: data,
        },
        {
          new: true,
        },
      )
      .exec();
  }

  // =========================================================
  // DELETE / SOFT DELETE
  // =========================================================

  async deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    if (
      !id ||
      !organizationId ||
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return false;
    }

    const result =
      await this.registrationModel
        .updateOne(
          {
            _id:
              new Types.ObjectId(id),

            organizationId:
              new Types.ObjectId(
                organizationId,
              ),

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
          },
          {
            $set: {
              deletedAt:
                new Date(),
            },
          },
        )
        .exec();

    return (
      result.modifiedCount > 0
    );
  }
}


// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model, Types } from 'mongoose';

// import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
// import {
//   TeamRegistration,
//   TeamRegistrationDocument,
// } from '../schemas/team-registration.schema';
// import { ITeamRegistrationRepository } from '../interfaces/team-registration-repository.interface';

// @Injectable()
// export class MongooseTeamRegistrationRepository
//   extends BaseTenantRepository<TeamRegistrationDocument>
//   implements ITeamRegistrationRepository
// {
//   constructor(
//     @InjectModel(TeamRegistration.name)
//     private readonly registrationModel: Model<TeamRegistrationDocument>,
//   ) {
//     super(registrationModel);
//   }

//   async findByTournamentForTenant(
//     tournamentId: string,
//     organizationId: string,
//   ): Promise<TeamRegistrationDocument[]> {
//     if (
//       !tournamentId ||
//       !organizationId ||
//       !Types.ObjectId.isValid(tournamentId)
//     ) {
//       return [];
//     }

//     return this.registrationModel
//       .find({
//         tournamentId: new Types.ObjectId(tournamentId),
//         organizationId: new Types.ObjectId(organizationId),
//         deletedAt: null,
//         status: 'registered',
//       })
//       .sort({ createdAt: 1 })
//       .exec();
//   }

//   async findByIdForTenant(
//     id: string,
//     organizationId: string,
//   ): Promise<TeamRegistrationDocument | null> {
//     if (
//       !id ||
//       !organizationId ||
//       !Types.ObjectId.isValid(id) ||
//       !Types.ObjectId.isValid(organizationId)
//     ) {
//       return null;
//     }

//     return this.registrationModel
//       .findOne({
//         _id: new Types.ObjectId(id),
//         organizationId: new Types.ObjectId(organizationId),
//         deletedAt: null,
//       })
//       .exec();
//   }

//   async create(
//     data: Partial<TeamRegistrationDocument>,
//   ): Promise<TeamRegistrationDocument> {
//     const registration = new this.registrationModel(data);
//     return registration.save();
//   }

//   async updateById(
//     id: string,
//     data: Partial<TeamRegistrationDocument>,
//   ): Promise<TeamRegistrationDocument | null> {
//     if (!Types.ObjectId.isValid(id)) {
//       return null;
//     }

//     return this.registrationModel
//       .findOneAndUpdate(
//         {
//           _id: new Types.ObjectId(id),
//           deletedAt: null,
//         },
//         {
//           $set: data,
//         },
//         {
//           new: true,
//         },
//       )
//       .exec();
//   }

//   async deleteByIdForTenant(
//     id: string,
//     organizationId: string,
//   ): Promise<boolean> {
//     if (
//       !Types.ObjectId.isValid(id) ||
//       !Types.ObjectId.isValid(organizationId)
//     ) {
//       return false;
//     }

//     const result = await this.registrationModel
//       .updateOne(
//         {
//           _id: new Types.ObjectId(id),
//           organizationId: new Types.ObjectId(organizationId),
//           deletedAt: null,
//         },
//         {
//           $set: {
//             deletedAt: new Date(),
//           },
//         },
//       )
//       .exec();

//     return result.modifiedCount > 0;
//   }
// }