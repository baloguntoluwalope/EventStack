import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
import { Membership, MembershipDocument } from '../schemas/membership.schema';
import { IMembershipRepository } from '../interfaces/membership-repository.interface';

@Injectable()
export class MongooseMembershipRepository
  extends BaseTenantRepository<MembershipDocument>
  implements IMembershipRepository
{
  constructor(@InjectModel(Membership.name) model: Model<MembershipDocument>) {
    super(model);
  }

  findByOrgAndUser(organizationId: string, userId: string) {
    return this.model
      .findOne({
        organizationId: new Types.ObjectId(organizationId),
        userId: new Types.ObjectId(userId),
        deletedAt: null,
      })
      .exec();
  }

  findByUser(userId: string) {
    return this.model
      .find({ userId: new Types.ObjectId(userId), status: 'accepted', deletedAt: null })
      .populate('organizationId', 'name logoUrl type')
      .exec();
  }

async softDeleteManyByOrg(organizationId: string): Promise<void> {
  await this.model.updateMany(
    { organizationId: new Types.ObjectId(organizationId), deletedAt: null },
    { deletedAt: new Date() },
  ).exec();
}
  
}