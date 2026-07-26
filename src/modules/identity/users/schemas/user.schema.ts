import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

@Schema({ timestamps: true })
export class User extends BaseEntity {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  name: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop()
  emailVerifiedAt: Date;

  /**
   * Platform-level admin — distinct from any organization Role. Grants
   * access to platform-catalog actions (creating Templates/Themes) that
   * have no owning organization. Not self-assignable via any API; set
   * directly in the database for the first admin (see bootstrap note
   * below), and only by an existing platform admin thereafter.
   */
  @Prop({ default: false })
  platformAdmin: boolean;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);