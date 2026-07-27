import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    return this.findOne({ organizationId, userId } as any);
  }

  findByUser(userId: string) {
    return this.model.find({ userId, status: 'accepted', deletedAt: null }).exec();
  }
}