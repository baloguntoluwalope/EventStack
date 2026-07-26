import { Prop } from '@nestjs/mongoose';

export class BaseEntity {
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: Number, default: 0 })
  version: number;
}