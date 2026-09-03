import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum PlayerStatus { ACTIVE = 'active', INJURED = 'injured', SUSPENDED = 'suspended', INACTIVE = 'inactive' }

@Schema({ timestamps: true })
export class Player extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  /** A player belongs to a Team's roster, not to any single tournament —
   * the team itself carries participation across tournaments via
   * TeamRegistration, so the player follows automatically without a
   * separate per-tournament player-registration table. */
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true, index: true })
  teamId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  photoUrl: string;

  @Prop()
  jerseyNumber: number;

  @Prop()
  position: string;

  @Prop({ enum: PlayerStatus, default: PlayerStatus.ACTIVE })
  status: PlayerStatus;
}
export type PlayerDocument = HydratedDocument<Player>;
export const PlayerSchema = SchemaFactory.createForClass(Player);