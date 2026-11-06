import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { BaseEntity } from '../../../../common/base/base-entity.schema';
import {
  FixtureStage,
  TeamSlot,
  TeamSlotSchema,
} from '../../fixtures/schemas/fixture.schema';

// =========================================================
// ENUMS
// =========================================================

export enum KnockoutMatchStatus {
  PENDING = 'pending', // waiting for one or both teams
  READY = 'ready', // both teams known
  COMPLETED = 'completed', // result recorded and winner routed
}

export enum KnockoutTargetSlot {
  HOME = 'home',
  AWAY = 'away',
}

// =========================================================
// SCHEMA
// =========================================================

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

  /**
   * Must include every stage the service can generate:
   * preliminary, round_of_64, round_of_32, round_of_16,
   * quarter_final, semi_final, third_place, final.
   */
  @Prop({ type: String, enum: FixtureStage, required: true })
  stage: FixtureStage;

  /** 1-based position of the match inside its stage. */
  @Prop({ type: Number, required: true, min: 1 })
  position: number;

  @Prop({ type: Types.ObjectId, ref: 'Fixture', default: null })
  fixtureId: Types.ObjectId | null;

  // =======================================================
  // SOURCE TEAMS
  // =======================================================

  @Prop({ type: TeamSlotSchema, required: true })
  homeSource: TeamSlot;

  @Prop({ type: TeamSlotSchema, required: true })
  awaySource: TeamSlot;

  // =======================================================
  // WINNER ROUTING
  // =======================================================

  @Prop({ type: Number, default: null })
  winnerFeedsToPosition: number | null;

  @Prop({ type: String, enum: FixtureStage, default: null })
  winnerFeedsToStage: FixtureStage | null;

  @Prop({ type: String, enum: KnockoutTargetSlot, default: null })
  winnerFeedsToSlot: KnockoutTargetSlot | null;

  // =======================================================
  // LOSER ROUTING (third-place / consolation)
  // =======================================================

  @Prop({ type: Number, default: null })
  loserFeedsToPosition: number | null;

  @Prop({ type: String, enum: FixtureStage, default: null })
  loserFeedsToStage: FixtureStage | null;

  @Prop({ type: String, enum: KnockoutTargetSlot, default: null })
  loserFeedsToSlot: KnockoutTargetSlot | null;

  // =======================================================
  // STATUS
  // =======================================================

  @Prop({
    type: String,
    enum: KnockoutMatchStatus,
    default: KnockoutMatchStatus.PENDING,
  })
  status: KnockoutMatchStatus;
}

export type KnockoutMatchDocument = HydratedDocument<KnockoutMatch>;

export const KnockoutMatchSchema = SchemaFactory.createForClass(KnockoutMatch);

// One match per position per stage per tournament.
KnockoutMatchSchema.index(
  { organizationId: 1, tournamentId: 1, stage: 1, position: 1 },
  { unique: true },
);

// Used by findByFixtureForTenant when a fixture finishes.
KnockoutMatchSchema.index({ organizationId: 1, fixtureId: 1 });



// import {
//   Prop,
//   Schema,
//   SchemaFactory,
// } from '@nestjs/mongoose';

// import {
//   HydratedDocument,
//   Types,
// } from 'mongoose';

// import {
//   BaseEntity,
// } from '../../../../common/base/base-entity.schema';

// import {
//   FixtureStage,
//   TeamSlot,
// } from '../../fixtures/schemas/fixture.schema';

// // =========================================================
// // STATUS
// // =========================================================

// export enum KnockoutMatchStatus {
//   PENDING = 'pending',

//   READY = 'ready',

//   COMPLETED = 'completed',
// }

// // =========================================================
// // TARGET SLOT
// // =========================================================

// export enum KnockoutTargetSlot {
//   HOME = 'home',

//   AWAY = 'away',
// }

// // =========================================================
// // SCHEMA
// // =========================================================

// @Schema({ timestamps: true })
// export class KnockoutMatch
//   extends BaseEntity
// {
//   @Prop({
//     type: Types.ObjectId,
//     ref: 'Organization',
//     required: true,
//     index: true,
//   })
//   organizationId: Types.ObjectId;

//   @Prop({
//     type: Types.ObjectId,
//     ref: 'Tournament',
//     required: true,
//     index: true,
//   })
//   tournamentId: Types.ObjectId;

//   @Prop({
//     enum: FixtureStage,
//     required: true,
//   })
//   stage: FixtureStage;

//   @Prop({
//     type: Number,
//     required: true,
//   })
//   position: number;

//   @Prop({
//     type: Types.ObjectId,
//     ref: 'Fixture',
//     default: null,
//   })
//   fixtureId: Types.ObjectId | null;

//   // =======================================================
//   // SOURCE TEAMS
//   // =======================================================

//   @Prop({
//     type: TeamSlot,
//     required: true,
//   })
//   homeSource: TeamSlot;

//   @Prop({
//     type: TeamSlot,
//     required: true,
//   })
//   awaySource: TeamSlot;

//   // =======================================================
//   // WINNER ROUTING
//   // =======================================================

//   @Prop({
//     type: Number,
//     default: null,
//   })
//   winnerFeedsToPosition: number | null;

//   @Prop({
//     type: String,
//     enum: FixtureStage,
//     default: null,
//   })
//   winnerFeedsToStage:
//     | FixtureStage
//     | null;

//   @Prop({
//     type: String,
//     enum: KnockoutTargetSlot,
//     default: null,
//   })
//   winnerFeedsToSlot:
//     | KnockoutTargetSlot
//     | null;

//   // =======================================================
//   // LOSER ROUTING
//   // =======================================================

//   @Prop({
//     type: Number,
//     default: null,
//   })
//   loserFeedsToPosition: number | null;

//   @Prop({
//     type: String,
//     enum: FixtureStage,
//     default: null,
//   })
//   loserFeedsToStage:
//     | FixtureStage
//     | null;

//   @Prop({
//     type: String,
//     enum: KnockoutTargetSlot,
//     default: null,
//   })
//   loserFeedsToSlot:
//     | KnockoutTargetSlot
//     | null;

//   // =======================================================
//   // STATUS
//   // =======================================================

//   @Prop({
//     enum: KnockoutMatchStatus,
//     default: KnockoutMatchStatus.PENDING,
//   })
//   status: KnockoutMatchStatus;
// }

// export type KnockoutMatchDocument =
//   HydratedDocument<KnockoutMatch>;

// export const KnockoutMatchSchema =
//   SchemaFactory.createForClass(
//     KnockoutMatch,
//   );