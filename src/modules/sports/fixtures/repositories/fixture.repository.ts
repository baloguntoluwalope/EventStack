import { Injectable } from '@nestjs/common';

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
  Fixture,
  FixtureDocument,
} from '../schemas/fixture.schema';

import {
  IFixtureRepository,
  FixtureFilters,
} from '../interfaces/fixture-repository.interface';

@Injectable()
export class MongooseFixtureRepository
  extends BaseTenantRepository<FixtureDocument>
  implements IFixtureRepository
{
  constructor(
    @InjectModel(Fixture.name)
    private readonly fixtureModel:
      Model<FixtureDocument>,
  ) {
    super(fixtureModel);
  }

  // =========================================================
  // FIND FIXTURES FOR TOURNAMENT
  // =========================================================

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
    filters: FixtureFilters = {},
  ): Promise<FixtureDocument[]> {
    if (
      !tournamentId ||
      !organizationId
    ) {
      return [];
    }

    const query: Record<string, any> = {
      tournamentId:
        Types.ObjectId.isValid(
          tournamentId,
        )
          ? new Types.ObjectId(
              tournamentId,
            )
          : tournamentId,

      organizationId:
        Types.ObjectId.isValid(
          organizationId,
        )
          ? new Types.ObjectId(
              organizationId,
            )
          : organizationId,

      deletedAt: null,
    };

    if (filters.groupId) {
      query.groupId =
        Types.ObjectId.isValid(
          filters.groupId,
        )
          ? new Types.ObjectId(
              filters.groupId,
            )
          : filters.groupId;
    }

    if (filters.stage) {
      query.stage =
        filters.stage;
    }

    if (
      filters.fromDate ||
      filters.toDate
    ) {
      query.scheduledAt = {};

      if (filters.fromDate) {
        query.scheduledAt.$gte =
          filters.fromDate;
      }

      if (filters.toDate) {
        query.scheduledAt.$lte =
          filters.toDate;
      }
    }

    return this.fixtureModel
      .find(query)
      .sort({
        scheduledAt: 1,
        createdAt: 1,
      })
      .exec();
  }

  // =========================================================
  // PUBLIC FIND
  // =========================================================

  findByIdPublic(
    id: string,
  ) {
    return this.fixtureModel
      .findOne({
        _id: id,
        deletedAt: null,
      })
      .exec();
  }
}