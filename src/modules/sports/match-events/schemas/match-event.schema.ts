import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum MatchEventType {
  GOAL = 'goal',
  OWN_GOAL = 'own_goal',
  DISALLOWED_GOAL = 'disallowed_goal',

  OFFSIDE = 'offside',
  FOUL = 'foul',

  PENALTY_AWARDED = 'penalty_awarded',
  PENALTY_CANCELLED = 'penalty_cancelled',

  FREE_KICK = 'free_kick',
  CORNER = 'corner',
  GOAL_KICK = 'goal_kick',
  THROW_IN = 'throw_in',

  YELLOW_CARD = 'yellow_card',
  SECOND_YELLOW = 'second_yellow',
  RED_CARD = 'red_card',

  SUBSTITUTION = 'substitution',
  INJURY = 'injury',

  PENALTY_SCORED = 'penalty_scored',
  PENALTY_MISSED = 'penalty_missed',
  PENALTY_SAVED = 'penalty_saved',

  // =========================================================
  // MATCH LIFECYCLE
  // =========================================================

  MATCH_STARTED = 'match_started',

  HALF_TIME = 'half_time',
  SECOND_HALF_STARTED = 'second_half_started',

  FULL_TIME = 'full_time',

  ADDED_TIME_ANNOUNCED = 'added_time_announced',

  EXTRA_TIME_START = 'extra_time_start',
  EXTRA_TIME_HALF_TIME = 'extra_time_half_time',
  EXTRA_TIME_SECOND_HALF_STARTED =
    'extra_time_second_half_started',
  EXTRA_TIME_END = 'extra_time_end',

  PENALTY_SHOOTOUT_START = 'penalty_shootout_start',
  PENALTY_SHOOTOUT_KICK = 'penalty_shootout_kick',
  PENALTY_SHOOTOUT_END = 'penalty_shootout_end',

  // =========================================================
  // MATCH CONTROL
  // =========================================================

  MATCH_SUSPENDED = 'match_suspended',
  MATCH_RESUMED = 'match_resumed',

  MATCH_ABANDONED = 'match_abandoned',
}

export enum MatchEventStatus {
  ACTIVE = 'active',
  VOIDED = 'voided',
}

@Schema({ timestamps: true })
export class MatchEvent extends BaseEntity {
  // =========================================================
  // TENANCY
  // =========================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  })
  organizationId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Tournament',
    required: true,
    index: true,
  })
  tournamentId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Match',
    required: true,
    index: true,
  })
  matchId: Types.ObjectId;

  // =========================================================
  // EVENT TYPE
  // =========================================================

  @Prop({
    type: String,
    enum: MatchEventType,
    required: true,
    index: true,
  })
  type: MatchEventType;

  // =========================================================
  // TEAM / PLAYERS
  // =========================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    default: null,
  })
  teamId: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  playerId: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  relatedPlayerId: Types.ObjectId | null;

  @Prop({
    type: Types.ObjectId,
    ref: 'Player',
    default: null,
  })
  secondaryPlayerId: Types.ObjectId | null;

  // =========================================================
  // FOOTBALL TIME
  // =========================================================

  /**
   * Official football minute.
   *
   * Examples:
   *
   * 12
   * 45
   * 90
   * 105
   */
  @Prop({
    type: Number,
    default: null,
  })
  minute: number | null;

  /**
   * Added-time minute.
   *
   * Examples:
   *
   * 45+2
   * 45+5
   * 90+4
   */
  @Prop({
    type: Number,
    default: null,
  })
  addedMinute: number | null;

  // =========================================================
  // METADATA
  // =========================================================

  @Prop({
    type: Object,
    default: {},
  })
  metadata: Record<string, any>;

  // =========================================================
  // EVENT STATUS
  // =========================================================

  @Prop({
    type: String,
    enum: MatchEventStatus,
    default: MatchEventStatus.ACTIVE,
    index: true,
  })
  status: MatchEventStatus;

  /**
   * Used for corrections.
   *
   * Example:
   *
   * Original GOAL
   *      ↓
   * DISALLOWED_GOAL
   *
   * The original event becomes VOIDED and the correction
   * references it through correctsEventId.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'MatchEvent',
    default: null,
  })
  correctsEventId: Types.ObjectId | null;

  // =========================================================
  // IDEMPOTENCY
  // =========================================================

  /**
   * Prevents accidental duplicate event creation.
   *
   * Unique only within a match through the compound index below.
   */
  @Prop({
    type: String,
    default: null,
  })
  idempotencyKey: string | null;

  // =========================================================
  // AUDIT
  // =========================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;
}

export type MatchEventDocument =
  HydratedDocument<MatchEvent>;

export const MatchEventSchema =
  SchemaFactory.createForClass(MatchEvent);

// =============================================================
// INDEXES
// =============================================================

/**
 * Idempotency is unique only within a match.
 *
 * Sparse allows normal events without an idempotency key.
 */
MatchEventSchema.index(
  {
    matchId: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

/**
 * Fast chronological event timeline.
 */
MatchEventSchema.index({
  matchId: 1,
  createdAt: 1,
});

/**
 * Useful when reconstructing active scoring events.
 */
MatchEventSchema.index({
  matchId: 1,
  status: 1,
  type: 1,
});