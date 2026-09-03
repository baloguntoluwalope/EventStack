import { Injectable } from '@nestjs/common';

import {
  InjectConnection,
  InjectModel,
} from '@nestjs/mongoose';

import {
  ClientSession,
  Connection,
  Model,
  Types,
} from 'mongoose';

import {
  BaseTenantRepository,
} from '../../../../common/base/base-tenant.repository';

import {
  MatchEvent,
  MatchEventDocument,
  MatchEventStatus,
  MatchEventType,
} from '../schemas/match-event.schema';

import {
  IMatchEventRepository,
} from '../interfaces/match-event-repository.interface';

@Injectable()
export class MongooseMatchEventRepository
  extends BaseTenantRepository<MatchEventDocument>
  implements IMatchEventRepository
{
  constructor(
    @InjectModel(MatchEvent.name)
    private readonly eventModel: Model<MatchEventDocument>,

    @InjectConnection()
    private readonly connection: Connection,
  ) {
    super(eventModel);
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    data: Partial<MatchEventDocument>,
    session?: ClientSession,
  ): Promise<MatchEventDocument> {
    const docs =
      await this.eventModel.create(
        [data],
        {
          session,
        },
      );

    return docs[0];
  }

  // =========================================================
  // FIND BY ID + TENANT
  // =========================================================

  async findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<MatchEventDocument | null> {
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

    return this.eventModel
      .findOne({
        _id: new Types.ObjectId(id),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        deletedAt: null,
      })
      .exec();
  }

  // =========================================================
  // FIND EVENTS FOR MATCH
  // =========================================================

  async findByMatchForTenant(
    matchId: string,
    organizationId: string,
  ): Promise<MatchEventDocument[]> {
    if (
      !matchId ||
      !organizationId ||
      !Types.ObjectId.isValid(
        matchId,
      ) ||
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return [];
    }

    return this.eventModel
      .find({
        matchId:
          new Types.ObjectId(
            matchId,
          ),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        deletedAt: null,
      })
      .sort({
        minute: 1,
        createdAt: 1,
      })
      .exec();
  }

  // =========================================================
  // IDEMPOTENCY
  // =========================================================

  async findByIdempotencyKey(
    matchId: string,
    idempotencyKey: string,
  ): Promise<MatchEventDocument | null> {
    if (
      !matchId ||
      !idempotencyKey ||
      !Types.ObjectId.isValid(
        matchId,
      )
    ) {
      return null;
    }

    return this.eventModel
      .findOne({
        matchId:
          new Types.ObjectId(
            matchId,
          ),

        idempotencyKey,

        deletedAt: null,
      })
      .exec();
  }

  // =========================================================
  // FIND ACTIVE SCORING EVENTS
  // =========================================================

  async findActiveGoalsForMatch(
    matchId: string,
    session?: ClientSession,
  ): Promise<MatchEventDocument[]> {
    if (
      !matchId ||
      !Types.ObjectId.isValid(
        matchId,
      )
    ) {
      return [];
    }

    /*
     * Only active scoring events are allowed to contribute
     * to the current match score.
     *
     * IMPORTANT:
     * disallowed_goal is NOT included.
     * cards are NOT included.
     * offside is NOT included.
     * substitution is NOT included.
     *
     * penalty_scored IS included because it is a scoring
     * event in match-event-effects.ts.
     */
    return this.eventModel
      .find({
        matchId:
          new Types.ObjectId(
            matchId,
          ),

        deletedAt: null,

        status:
          MatchEventStatus.ACTIVE,

        type: {
          $in: [
            MatchEventType.GOAL,
            MatchEventType.OWN_GOAL,
            MatchEventType.PENALTY_SCORED,
          ],
        },
      })
      .session(
        session ?? null,
      )
      .exec();
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async updateById(
    id: string,
    data: Partial<MatchEventDocument>,
    session?: ClientSession,
  ): Promise<MatchEventDocument | null> {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      return null;
    }

    return this.eventModel
      .findOneAndUpdate(
        {
          _id:
            new Types.ObjectId(id),

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
  // TRANSACTION
  // =========================================================

  async withTransaction<T>(
    fn: (
      session: ClientSession,
    ) => Promise<T>,
  ): Promise<T> {
    const session =
      await this.connection.startSession();

    try {
      let result!: T;

      await session.withTransaction(
        async () => {
          result =
            await fn(
              session,
            );
        },
      );

      return result;
    } finally {
      await session.endSession();
    }
  }

  async findActiveForMatch(
  matchId: string,
  organizationId: string,
) {
  return this.model
    .find({
      matchId: new Types.ObjectId(matchId),
      organizationId: new Types.ObjectId(
        organizationId,
      ),
      status: MatchEventStatus.ACTIVE,
    })
    .sort({
      minute: 1,
      createdAt: 1,
    })
    .lean();
}

// =========================================================
// FIND EVENTS FOR MATCH — PUBLIC
// =========================================================

async findByMatchPublic(
  matchId: string,
): Promise<MatchEventDocument[]> {
  if (
    !matchId ||
    !Types.ObjectId.isValid(matchId)
  ) {
    return [];
  }

  return this.eventModel
    .find({
      matchId:
        new Types.ObjectId(matchId),

      deletedAt: null,
    })
    .sort({
      minute: 1,
      createdAt: 1,
    })
    .exec();
}

}