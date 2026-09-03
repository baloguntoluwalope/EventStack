import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  HALFTIME = 'halftime',
  EXTRA_TIME = 'extra_time',
  PENALTIES = 'penalties',
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
    ref: 'Fixture',
    required: true,
    unique: true,
    index: true,
  })
  fixtureId: Types.ObjectId;

  @Prop({
    type: Object,
    default: null,
  })
  penaltyResult: {
    homeScore: number;
    awayScore: number;
  } | null;

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

  @Prop({
    type: String,
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @Prop({
    type: String,
    enum: MatchPeriod,
    default: MatchPeriod.PRE_MATCH,
  })
  currentPeriod: MatchPeriod;

  @Prop({
    type: Number,
    default: 0,
  })
  currentAddedTime: number;

  @Prop({
    type: Date,
    default: null,
  })
  pausedAt: Date | null;

  /**
   * Placeholder fields — not mutated by anything in this phase.
   * The next phase (Match Events) becomes the sole writer of these fields.
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

  @Prop({
    type: String,
  })
  period: string;

  @Prop({
    type: Number,
  })
  addedTime: number;

  @Prop({
    type: Date,
  })
  startedAt: Date;

  @Prop({
    type: Date,
  })
  periodStartedAt: Date;

  @Prop({
    type: Date,
  })
  endedAt: Date;

  @Prop({
    type: String,
    enum: MatchResult,
    default: null,
  })
  result: MatchResult | null;
}

export type MatchDocument = HydratedDocument<Match>;

export const MatchSchema = SchemaFactory.createForClass(Match);