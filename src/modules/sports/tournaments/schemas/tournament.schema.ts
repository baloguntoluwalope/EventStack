import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum TournamentStatus { DRAFT = 'draft', SETUP = 'setup', PUBLISHED = 'published', ACTIVE = 'active', COMPLETED = 'completed', ARCHIVED = 'archived' }
export enum TournamentFormat { LEAGUE = 'league', GROUP_ONLY = 'group_only', KNOCKOUT_ONLY = 'knockout_only', GROUP_AND_KNOCKOUT = 'group_and_knockout' }

@Schema({ _id: false })
class ScoringRules {
  @Prop({ default: 3 }) winPoints: number;
  @Prop({ default: 1 }) drawPoints: number;
  @Prop({ default: 0 }) lossPoints: number;
}

@Schema({ timestamps: true })
export class Tournament extends BaseEntity {
 @Prop({
  type: Types.ObjectId,
  ref: 'Organization',
  required: true,
  index: true,
})
organizationId: Types.ObjectId;

  @Prop({
  type: Types.ObjectId,
  ref: 'Event',
  required: true,
  index: true,
})
eventId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  /** Deliberately a free-form string, not a hardcoded enum — scoring/format
   * rules already vary per tournament instance, so the sport itself
   * shouldn't be constrained at the schema level. */
  @Prop({ default: 'football' })
  sport: string;

  @Prop({ enum: TournamentFormat, default: TournamentFormat.GROUP_AND_KNOCKOUT })
  format: TournamentFormat;

  @Prop({ enum: TournamentStatus, default: TournamentStatus.DRAFT })
  status: TournamentStatus;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ type: ScoringRules, default: {} })
  scoringRules: ScoringRules;

  @Prop({ type: [String], default: ['goalDifference', 'goalsFor', 'headToHead'] })
  tieBreakRules: string[];

  /** Reserved, not enforced yet — populated when the Knockout engine
   * (deferred to a later increment) needs a place to store bracket shape. */
  @Prop({ type: Object, default: {} })
  knockoutConfiguration: Record<string, any>;
}
export type TournamentDocument = HydratedDocument<Tournament>;
export const TournamentSchema = SchemaFactory.createForClass(Tournament);