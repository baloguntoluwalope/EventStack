import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum TeamStatus { ACTIVE = 'active', INACTIVE = 'inactive' }

@Schema({ timestamps: true })
export class Team extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  shortName: string;

  @Prop()
  logoUrl: string;

  @Prop()
  color: string;

  @Prop({ enum: TeamStatus, default: TeamStatus.ACTIVE })
  status: TeamStatus;
}
export type TeamDocument = HydratedDocument<Team>;
export const TeamSchema = SchemaFactory.createForClass(Team);