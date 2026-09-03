import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';
import { FixtureStage, TeamSlot } from '../../fixtures/schemas/fixture.schema';

export enum KnockoutMatchStatus {
  PENDING = 'pending',
  READY = 'ready',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class KnockoutMatch extends BaseEntity {
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
    enum: FixtureStage,
    required: true,
  })
  stage: FixtureStage;

  @Prop({
    type: Number,
    required: true,
  })
  position: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'Fixture',
    default: null,
  })
  fixtureId: Types.ObjectId | null;

  @Prop({
    type: TeamSlot,
    required: true,
  })
  homeSource: TeamSlot;

  @Prop({
    type: TeamSlot,
    required: true,
  })
  awaySource: TeamSlot;

  @Prop({
    type: Number,
    default: null,
  })
  winnerFeedsToPosition: number | null;

  @Prop({
    type: Number,
    default: null,
  })
  loserFeedsToPosition: number | null;

  @Prop({
    type: String,
    enum: FixtureStage,
    default: null,
  })
  winnerFeedsToStage: FixtureStage | null;

  @Prop({
    type: String,
    enum: FixtureStage,
    default: null,
  })
  loserFeedsToStage: FixtureStage | null;

  @Prop({
    enum: KnockoutMatchStatus,
    default: KnockoutMatchStatus.PENDING,
  })
  status: KnockoutMatchStatus;
}

export type KnockoutMatchDocument = HydratedDocument<KnockoutMatch>;

export const KnockoutMatchSchema =
  SchemaFactory.createForClass(KnockoutMatch);