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
  Team,
  TeamDocument,
} from '../schemas/team.schema';

import {
  ITeamRepository,
} from '../interfaces/team-repository.interface';

@Injectable()
export class MongooseTeamRepository
  extends BaseTenantRepository<TeamDocument>
  implements ITeamRepository
{
  constructor(
    @InjectModel(Team.name)
    model: Model<TeamDocument>,
  ) {
    super(model);
  }

  /**
   * Find one team belonging to one organization.
   *
   * IMPORTANT:
   * Both _id and organizationId are stored as MongoDB ObjectIds.
   * Always query them as ObjectIds.
   */
  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<TeamDocument | null> {
    if (!id || !organizationId) {
      console.log(
        '[TeamRepository] Missing lookup parameters',
        {
          id,
          organizationId,
        },
      );

      return null;
    }

    if (!Types.ObjectId.isValid(id)) {
      console.log(
        '[TeamRepository] Invalid team ObjectId',
        {
          id,
        },
      );

      return null;
    }

    if (!Types.ObjectId.isValid(organizationId)) {
      console.log(
        '[TeamRepository] Invalid organization ObjectId',
        {
          organizationId,
        },
      );

      return null;
    }

    const teamObjectId =
      new Types.ObjectId(id);

    const organizationObjectId =
      new Types.ObjectId(organizationId);

    console.log(
      '[TeamRepository] FIND TEAM',
      {
        teamId: id,
        organizationId,
      },
    );

    /**
     * First verify that the team exists by ID.
     *
     * This makes debugging much easier because we can
     * distinguish:
     *
     * 1. Team does not exist.
     * 2. Team exists but belongs to another organization.
     * 3. Team exists but was soft deleted.
     */
    const teamById =
      await this.model
        .findOne({
          _id: teamObjectId,
        })
        .exec();

    if (!teamById) {
      console.log(
        '[TeamRepository] TEAM DOES NOT EXIST',
        {
          teamId: id,
        },
      );

      return null;
    }

    console.log(
      '[TeamRepository] TEAM FOUND BY ID',
      {
        teamId: String(teamById._id),
        teamOrganizationId:
          String(teamById.organizationId),
        requestedOrganizationId:
          organizationId,
        deletedAt:
          teamById.deletedAt,
      },
    );

    /**
     * Now enforce tenant isolation.
     */
    const team =
      await this.model
        .findOne({
          _id: teamObjectId,
          organizationId: organizationObjectId,
          deletedAt: null,
        })
        .exec();

    if (!team) {
      console.log(
        '[TeamRepository] TEAM FAILED TENANT CHECK',
        {
          teamId: id,
          organizationId,
          actualOrganizationId:
            String(teamById.organizationId),
          deletedAt:
            teamById.deletedAt,
        },
      );

      return null;
    }

    console.log(
      '[TeamRepository] TEAM FOUND FOR TENANT',
      {
        teamId: String(team._id),
        organizationId:
          String(team.organizationId),
        name: team.name,
      },
    );

    return team;
  }

  /**
   * List all non-deleted teams belonging to the organization.
   */
  async findManyForTenant(
    organizationId: string,
  ): Promise<TeamDocument[]> {
    if (
      !organizationId ||
      !Types.ObjectId.isValid(organizationId)
    ) {
      return [];
    }

    const organizationObjectId =
      new Types.ObjectId(organizationId);

    return this.model
      .find({
        organizationId: organizationObjectId,
        deletedAt: null,
      })
      .sort({
        createdAt: -1,
      })
      .exec();
  }

  /**
   * Create an organization-level team.
   *
   * The service should provide organizationId,
   * but we normalize it here to an ObjectId to guarantee
   * consistency with the schema.
   */
  async create(
    data: Partial<TeamDocument>,
  ): Promise<TeamDocument> {
    const normalizedData: any = {
      ...data,
    };

    if (
      normalizedData.organizationId &&
      typeof normalizedData.organizationId === 'string'
    ) {
      normalizedData.organizationId =
        new Types.ObjectId(
          normalizedData.organizationId,
        );
    }

    const team =
      new this.model(normalizedData);

    const savedTeam =
      await team.save();

    console.log(
      '[TeamRepository] TEAM CREATED',
      {
        id: String(savedTeam._id),
        organizationId:
          String(savedTeam.organizationId),
        name: savedTeam.name,
      },
    );

    return savedTeam;
  }

  /**
   * Update a team by ID.
   */
  async updateById(
    id: string,
    data: Partial<TeamDocument>,
  ): Promise<TeamDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.model
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
        },
      )
      .exec();
  }

  /**
   * Soft-delete a team.
   */
  async deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(organizationId)
    ) {
      return false;
    }

    const result =
      await this.model
        .updateOne(
          {
            _id: new Types.ObjectId(id),
            organizationId:
              new Types.ObjectId(
                organizationId,
              ),
            deletedAt: null,
          },
          {
            $set: {
              deletedAt: new Date(),
            },
          },
        )
        .exec();

    return result.modifiedCount > 0;
  }

  /**
   * Public name lookup.
   */
  async findNamesByIdsPublic(
    ids: string[],
  ): Promise<
    {
      id: string;
      name: string;
      shortName?: string;
      logoUrl?: string;
    }[]
  > {
    const validIds =
      ids.filter((id) =>
        Types.ObjectId.isValid(id),
      );

    if (!validIds.length) {
      return [];
    }

    const docs =
      await this.model.find(
        {
          _id: {
            $in: validIds.map(
              (id) =>
                new Types.ObjectId(id),
            ),
          },
          deletedAt: null,
        },
        'name shortName logoUrl',
      ).exec();

    return docs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      shortName: doc.shortName,
      logoUrl: doc.logoUrl,
    }));
  }
}