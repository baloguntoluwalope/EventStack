import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';
import { FixtureStage } from '../../fixtures/schemas/fixture.schema';

export enum KnockoutStageStatus { PENDING = 'pending', ACTIVE = 'active', COMPLETED = 'completed' }

@Schema({ timestamps: true })
export class KnockoutStage extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tournament', required: true, index: true })
  tournamentId: Types.ObjectId;

  @Prop({ enum: FixtureStage, required: true })
  stage: FixtureStage;

  @Prop({ required: true })
  order: number;

  @Prop({ enum: KnockoutStageStatus, default: KnockoutStageStatus.PENDING })
  status: KnockoutStageStatus;
}
export type KnockoutStageDocument = HydratedDocument<KnockoutStage>;
export const KnockoutStageSchema = SchemaFactory.createForClass(KnockoutStage);