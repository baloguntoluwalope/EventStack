import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../../../common/base/base-entity.schema';

export enum TaskStatus { PENDING = 'pending', IN_PROGRESS = 'in_progress', COMPLETED = 'completed' }

@Schema({ timestamps: true })
export class Task extends BaseEntity {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true, index: true })
  eventId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  assignedToUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedByUserId: Types.ObjectId;

  @Prop({ required: true }) title: string;
  @Prop() description: string;
  @Prop() dueAt: Date;

  @Prop({ enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  /** Optional link back to a FormShift — "you're on the gate 2-4pm" can
   * reference the exact shift a volunteer signed up for, without
   * duplicating its time range here. Null for tasks unrelated to a
   * shift. */
  @Prop({ type: String, default: null })
  shiftId: string | null;
}
export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);