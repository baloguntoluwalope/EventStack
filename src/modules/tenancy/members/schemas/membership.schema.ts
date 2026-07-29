import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';
import { Role } from '../../../../common/constants/roles.constants';

export enum MembershipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
}

@Schema({ timestamps: true })
export class Membership extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Role, required: true })
  role: Role;

  @Prop()
  invitedEmail: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  invitedBy: Types.ObjectId;

  @Prop({ type: String, enum: MembershipStatus, default: MembershipStatus.PENDING })
  status: MembershipStatus;
}

export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);

// Compound index to ensure a user only has one membership per organization
MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true, sparse: true });