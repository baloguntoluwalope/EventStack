import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from '../../../../common/base/base-entity.schema';

export enum OrgType {
  CHURCH = 'church',
  SCHOOL = 'school',
  NGO = 'ngo',
  CORPORATE = 'corporate',
  CONFERENCE = 'conference',
  WEDDING = 'wedding',
  COMMUNITY = 'community',
}

@Schema({ _id: false })
export class Contact {
  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ type: [String], default: [] })
  socials?: string[];
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

@Schema({ timestamps: true })
export class Organization extends BaseEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ enum: OrgType, required: true })
  type: OrgType;

  @Prop()
  logoUrl?: string;

  @Prop({ type: Object, default: {} })
  theme?: Record<string, any>;

  @Prop({ type: ContactSchema, default: {} })
  contact?: Contact;

  @Prop({ default: 'UTC' })
  timezone?: string;
}

export type OrganizationDocument = HydratedDocument<Organization>;
export const OrganizationSchema = SchemaFactory.createForClass(Organization);