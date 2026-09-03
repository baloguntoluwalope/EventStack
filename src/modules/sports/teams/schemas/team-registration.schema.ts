import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum RegistrationStatus { REGISTERED = 'registered', WITHDRAWN = 'withdrawn' }

@Schema({ timestamps: true })
export class TeamRegistration extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tournament', required: true, index: true })
  tournamentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Team', required: true, index: true })
  teamId: Types.ObjectId;

  /** Null until the team is assigned to a group — a real, common
   * intermediate state during tournament setup. */
  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  groupId: Types.ObjectId | null;

  @Prop({ enum: RegistrationStatus, default: RegistrationStatus.REGISTERED })
  status: RegistrationStatus;
}
export type TeamRegistrationDocument = HydratedDocument<TeamRegistration>;
export const TeamRegistrationSchema = SchemaFactory.createForClass(TeamRegistration);