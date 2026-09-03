import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';

import {
  Player,
  PlayerDocument,
} from '../schemas/player.schema';

import {
  IPlayerRepository,
} from '../interfaces/player-repository.interface';

@Injectable()
export class MongoosePlayerRepository
  extends BaseTenantRepository<PlayerDocument>
  implements IPlayerRepository
{
  constructor(
    @InjectModel(Player.name)
    private readonly playerModel: Model<PlayerDocument>,
  ) {
    super(playerModel);
  }

  /**
   * Create a player.
   */
  async create(
    data: Partial<PlayerDocument>,
  ): Promise<PlayerDocument> {
    const player =
      new this.playerModel(data);

    return player.save();
  }

  /**
   * Find one player belonging to the organization.
   */
  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<PlayerDocument | null> {
    if (!id || !organizationId) {
      return null;
    }

    return this.playerModel
      .findOne({
        _id: id,
        organizationId,
        deletedAt: null,
      })
      .exec();
  }

  /**
   * List all players belonging to a team
   * inside the organization.
   *
   * We query explicitly instead of relying on
   * BaseTenantRepository's optional filter.
   */
  async findByTeamForTenant(
    teamId: string,
    organizationId: string,
  ): Promise<PlayerDocument[]> {
    if (!teamId || !organizationId) {
      return [];
    }

    console.log(
      '[PlayerRepository] Finding players:',
      {
        teamId,
        organizationId,
      },
    );

    const players =
      await this.playerModel
        .find({
          teamId,
          organizationId,
          deletedAt: null,
        })
        .sort({
          createdAt: 1,
        })
        .exec();

    console.log(
      '[PlayerRepository] Players found:',
      players.length,
    );

    return players;
  }

  /**
   * Update player.
   */
  async updateById(
    id: string,
    data: Partial<PlayerDocument>,
  ): Promise<PlayerDocument | null> {
    if (!id) {
      return null;
    }

    return this.playerModel
      .findOneAndUpdate(
        {
          _id: id,
          deletedAt: null,
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

  /**
   * Soft-delete player.
   */
  async deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    if (!id || !organizationId) {
      return false;
    }

    const result =
      await this.playerModel.updateOne(
        {
          _id: id,
          organizationId,
          deletedAt: null,
        },
        {
          $set: {
            deletedAt: new Date(),
          },
        },
      ).exec();

    return result.modifiedCount > 0;
  }
}



// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
// import { Player, PlayerDocument } from '../schemas/player.schema';
// import { IPlayerRepository } from '../interfaces/player-repository.interface';

// @Injectable()
// export class MongoosePlayerRepository extends BaseTenantRepository<PlayerDocument> implements IPlayerRepository {
//   constructor(@InjectModel(Player.name) model: Model<PlayerDocument>) { super(model); }

//   findByTeamForTenant(teamId: string, organizationId: string) {
//     return this.findManyForTenant(organizationId, { teamId } as any);
//   }
// }