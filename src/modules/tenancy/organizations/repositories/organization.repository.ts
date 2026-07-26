import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongooseRepository } from '../../../../common/base/base-mongoose.repository';
import { Organization, OrganizationDocument } from '../schemas/organization.schema';
import { IOrganizationRepository } from '../interfaces/organization-repository.interface';

@Injectable()
export class MongooseOrganizationRepository
  extends BaseMongooseRepository<OrganizationDocument>
  implements IOrganizationRepository
{
  constructor(@InjectModel(Organization.name) model: Model<OrganizationDocument>) {
    super(model);
  }
}