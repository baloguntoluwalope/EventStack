import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';

import {
  Group,
  GroupDocument,
} from '../schemas/group.schema';

import {
  IGroupRepository,
} from '../interfaces/group-repository.interface';

@Injectable()
export class MongooseGroupRepository
  extends BaseTenantRepository<GroupDocument>
  implements IGroupRepository
{
  constructor(
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
  ) {
    super(groupModel);
  }

  /**
   * Create a tournament group.
   */
  async create(
    data: Partial<GroupDocument>,
  ): Promise<GroupDocument> {
    const group =
      new this.groupModel(data);

    return group.save();
  }

  /**
   * Find one group belonging to an organization.
   */
  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<GroupDocument | null> {
    if (!id || !organizationId) {
      return null;
    }

    return this.groupModel
      .findOne({
        _id: id,
        organizationId,
        deletedAt: null,
      })
      .exec();
  }

  /**
   * Get all groups belonging to a tournament
   * inside the organization.
   *
   * IMPORTANT:
   * Do not rely on BaseTenantRepository's optional
   * filter here. Query the actual fields explicitly.
   */
  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<GroupDocument[]> {
    if (!tournamentId || !organizationId) {
      return [];
    }

    console.log(
      '[GroupRepository] Finding groups:',
      {
        tournamentId,
        organizationId,
      },
    );

    const groups =
      await this.groupModel
        .find({
          organizationId,
          tournamentId,
          deletedAt: null,
        })
        .sort({
          order: 1,
          createdAt: 1,
        })
        .exec();

    console.log(
      '[GroupRepository] Groups found:',
      groups.length,
    );

    return groups;
  }

  /**
   * Update a group.
   */
  async updateById(
    id: string,
    data: Partial<GroupDocument>,
  ): Promise<GroupDocument | null> {
    if (!id) {
      return null;
    }

    return this.groupModel
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
   * Soft-delete a group.
   */
  async deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    if (!id || !organizationId) {
      return false;
    }

    const result =
      await this.groupModel.updateOne(
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