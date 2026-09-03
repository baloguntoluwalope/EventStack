import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum FixtureStage {
  GROUP_STAGE = 'group_stage',
  ROUND_OF_16 = 'round_of_16',
  QUARTER_FINAL = 'quarter_final',
  SEMI_FINAL = 'semi_final',
  THIRD_PLACE = 'third_place',
  FINAL = 'final',
}

export enum FixtureStatus {
  SCHEDULED = 'scheduled',
  POSTPONED = 'postponed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum TeamSlotType {
  FIXED = 'fixed',
  GROUP_POSITION = 'group_position',
  MATCH_WINNER = 'match_winner',
  MATCH_LOSER = 'match_loser',
}

@Schema({ _id: false })
export class TeamSlot {
  @Prop({ enum: TeamSlotType, required: true })
  type: TeamSlotType;

  @Prop({ type: Types.ObjectId, ref: 'Team', default: null })
  teamId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  groupId: Types.ObjectId | null;

  @Prop({ type: Number, default: null })
  position: number | null;

  @Prop({ type: Types.ObjectId, ref: 'Fixture', default: null })
  sourceFixtureId: Types.ObjectId | null;
}

const TeamSlotSchema = SchemaFactory.createForClass(TeamSlot);

@Schema({ timestamps: true })
export class Fixture extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tournament', required: true, index: true })
  tournamentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  groupId: Types.ObjectId | null;

  @Prop({ enum: FixtureStage, default: FixtureStage.GROUP_STAGE })
  stage: FixtureStage;

  @Prop({ type: TeamSlotSchema, required: true })
  homeSlot: TeamSlot;

  @Prop({ type: TeamSlotSchema, required: true })
  awaySlot: TeamSlot;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ type: String })
  venueName: string;

  @Prop({ type: String })
  venueAddress: string;

  /** Knockout bracket ordering — null for league/group-stage fixtures. */
  @Prop({ type: Number, default: null })
  round: number | null;

  @Prop({ type: Number, default: null })
  bracketPosition: number | null;

  @Prop({ enum: FixtureStatus, default: FixtureStatus.SCHEDULED })
  status: FixtureStatus;
}

export type FixtureDocument = HydratedDocument<Fixture>;
export const FixtureSchema = SchemaFactory.createForClass(Fixture);