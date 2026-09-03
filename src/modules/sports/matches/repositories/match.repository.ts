import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ClientSession,
  Model,
  Types,
} from 'mongoose';

import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';

import {
  Match,
  MatchDocument,
} from '../schemas/match.schema';

import {
  IMatchRepository,
} from '../interfaces/match-repository.interface';

@Injectable()
export class MongooseMatchRepository
  extends BaseTenantRepository<MatchDocument>
  implements IMatchRepository
{
  constructor(
    @InjectModel(Match.name)
    private readonly matchModel: Model<MatchDocument>,
  ) {
    super(matchModel);
  }

  // =========================================================
  // FIND BY ID + TENANT
  // =========================================================

  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<MatchDocument | null> {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      return null;
    }

    const match =
      await this.matchModel
        .findOne({
          _id: new Types.ObjectId(id),
          deletedAt: null,
        })
        .exec();

    if (!match) {
      return null;
    }

    /*
     * Keep tenant isolation here.
     * We compare as strings so this works whether
     * an older document contains ObjectId or string data.
     */
    const matchOrganizationId =
      String(
        (match as any)
          .organizationId ?? '',
      );

    if (
      matchOrganizationId !==
      String(organizationId)
    ) {
      return null;
    }

    return match;
  }

  // =========================================================
  // FIND BY FIXTURE + TENANT
  // =========================================================

  async findByFixtureForTenant(
    fixtureId: string,
    organizationId: string,
  ): Promise<MatchDocument | null> {
    if (
      !fixtureId ||
      !Types.ObjectId.isValid(
        fixtureId,
      )
    ) {
      return null;
    }

    const match =
      await this.matchModel
        .findOne({
          fixtureId:
            new Types.ObjectId(
              fixtureId,
            ),
          deletedAt: null,
        })
        .exec();

    if (!match) {
      return null;
    }

    const matchOrganizationId =
      String(
        (match as any)
          .organizationId ?? '',
      );

    if (
      matchOrganizationId !==
      String(organizationId)
    ) {
      return null;
    }

    return match;
  }

  // =========================================================
  // FIND MATCHES FOR TOURNAMENT
  // =========================================================

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<MatchDocument[]> {
    if (
      !tournamentId ||
      !Types.ObjectId.isValid(
        tournamentId,
      )
    ) {
      return [];
    }

    const matches =
      await this.matchModel
        .find({
          tournamentId:
            new Types.ObjectId(
              tournamentId,
            ),
          deletedAt: null,
        })
        .sort({
          createdAt: -1,
        })
        .exec();

    return matches.filter(
      (match) =>
        String(
          (match as any)
            .organizationId ?? '',
        ) === String(
          organizationId,
        ),
    );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  updateById(
    id: string,
    data: Partial<MatchDocument>,
    session?: ClientSession,
  ) {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      return Promise.resolve(
        null,
      );
    }

    return this.matchModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          deletedAt: null,
        },
        {
          $set: data,
        },
        {
          new: true,
          session,
        },
      )
      .exec();
  }

  // =========================================================
  // PUBLIC
  // =========================================================

  findById(
    id: string,
  ): Promise<MatchDocument | null> {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      return Promise.resolve(
        null,
      );
    }

    return this.matchModel
      .findOne({
        _id: new Types.ObjectId(id),
        deletedAt: null,
      })
      .exec();
  }

  // =========================================================
  // PUBLIC BY FIXTURE
  // =========================================================

  findByFixturePublic(
    fixtureId: string,
  ) {
    if (
      !fixtureId ||
      !Types.ObjectId.isValid(
        fixtureId,
      )
    ) {
      return Promise.resolve(
        null,
      );
    }

    return this.matchModel
      .findOne({
        fixtureId:
          new Types.ObjectId(
            fixtureId,
          ),
        deletedAt: null,
      })
      .exec();
  }

async findByTournamentPublic(
  tournamentId: string,
): Promise<MatchDocument[]> {
  if (!tournamentId) {
    return [];
  }

  if (!Types.ObjectId.isValid(tournamentId)) {
    return [];
  }

  return this.matchModel
    .find({
      tournamentId: new Types.ObjectId(tournamentId),
      deletedAt: null,
    })
    .sort({
      startedAt: -1,
      createdAt: -1,
    })
    .exec();
}

}
