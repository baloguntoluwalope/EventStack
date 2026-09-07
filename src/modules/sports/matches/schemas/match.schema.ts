import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  HALFTIME = 'halftime',
  EXTRA_TIME = 'extra_time',
  PENALTIES = 'penalties',
  PAUSED = 'paused',
  FINISHED = 'finished',
  ABANDONED = 'abandoned',
}

export enum MatchResult {
  HOME_WIN = 'home_win',
  AWAY_WIN = 'away_win',
  DRAW = 'draw',
}

export enum MatchPeriod {
  PRE_MATCH = 'pre_match',
  FIRST_HALF = 'first_half',
  HALF_TIME = 'half_time',
  SECOND_HALF = 'second_half',
  FULL_TIME = 'full_time',
  EXTRA_TIME = 'extra-time',
  EXTRA_TIME_FIRST_HALF = 'extra_time_first_half',
  EXTRA_TIME_HALF_TIME = 'extra_time_half_time',
  EXTRA_TIME_SECOND_HALF = 'extra_time_second_half',
  PENALTY_SHOOTOUT = 'penalty_shootout',
}

@Schema({ timestamps: true })
export class Match extends BaseEntity {
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

  // =========================================================
  // FIXTURE
  // =========================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'Fixture',
    required: true,
    unique: true,
    index: true,
  })
  fixtureId: Types.ObjectId;

  // =========================================================
  // TEAMS
  // =========================================================

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  homeTeamId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Team',
    required: true,
  })
  awayTeamId: Types.ObjectId;

  // =========================================================
  // MATCH STATUS
  // =========================================================

  @Prop({
    type: String,
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  // =========================================================
  // FOOTBALL PERIOD
  // =========================================================

  @Prop({
    type: String,
    enum: MatchPeriod,
    default: MatchPeriod.PRE_MATCH,
  })
  currentPeriod: MatchPeriod;

  /**
   * Added time belonging to the CURRENT period.
   *
   * Example:
   *
   * FIRST_HALF + 5
   * SECOND_HALF + 5
   * EXTRA_TIME_FIRST_HALF + 2
   */
  @Prop({
    type: Number,
    default: 0,
  })
  currentAddedTime: number;

  /**
   * Legacy/display period field.
   *
   * Kept for compatibility with existing code.
   */
  @Prop({
    type: String,
  })
  period: string;

  // =========================================================
  // PAUSE / RESUME
  // =========================================================

  /**
   * Timestamp at which the match was suspended.
   *
   * Null whenever the match is not paused.
   */
  @Prop({
    type: Date,
    default: null,
  })
  pausedAt: Date | null;

  /**
   * Status that existed immediately before PAUSED.
   *
   * Examples:
   *
   * LIVE -> PAUSED
   * pausedFromStatus = LIVE
   *
   * EXTRA_TIME -> PAUSED
   * pausedFromStatus = EXTRA_TIME
   *
   * PENALTIES -> PAUSED
   * pausedFromStatus = PENALTIES
   */
  @Prop({
    type: String,
    enum: MatchStatus,
    default: null,
  })
  pausedFromStatus: MatchStatus | null;

  // =========================================================
  // SCORE
  // =========================================================

  /**
   * Cached score.
   *
   * Match Events remain the source of truth.
   */
  @Prop({
    type: Number,
    default: 0,
  })
  homeScore: number;

  @Prop({
    type: Number,
    default: 0,
  })
  awayScore: number;

  // =========================================================
  // PENALTY SHOOTOUT RESULT
  // =========================================================

  @Prop({
    type: Object,
    default: null,
  })
  penaltyResult: {
    homeScore: number;
    awayScore: number;
  } | null;

  // =========================================================
  // TIMING
  // =========================================================

  /**
   * Match start timestamp.
   */
  @Prop({
    type: Date,
    default: null,
  })
  startedAt: Date | null;

  /**
   * Start timestamp of the CURRENT football period.
   *
   * The pause/resume logic adjusts this timestamp so that
   * suspended time is not counted by the frontend clock.
   */
  @Prop({
    type: Date,
    default: null,
  })
  periodStartedAt: Date | null;

  /**
   * Match end timestamp.
   */
  @Prop({
    type: Date,
    default: null,
  })
  endedAt: Date | null;

  // =========================================================
  // LEGACY ADDED TIME
  // =========================================================

  /**
   * Kept for compatibility with existing code.
   *
   * New clock logic should use currentAddedTime.
   */
  @Prop({
    type: Number,
    default: 0,
  })
  addedTime: number;

  // =========================================================
  // RESULT
  // =========================================================

  @Prop({
    type: String,
    enum: MatchResult,
    default: null,
  })
  result: MatchResult | null;
}

export type MatchDocument =
  HydratedDocument<Match>;

export const MatchSchema =
  SchemaFactory.createForClass(Match);