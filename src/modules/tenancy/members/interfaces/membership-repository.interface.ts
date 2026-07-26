import { MembershipDocument } from '../schemas/membership.schema';

export interface IMembershipRepository {
  create(data: Partial<MembershipDocument>): Promise<MembershipDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<MembershipDocument | null>;
  findManyForTenant(organizationId: string): Promise<MembershipDocument[]>;
  findByOrgAndUser(organizationId: string, userId: string): Promise<MembershipDocument | null>;
  updateById(id: string, data: Partial<MembershipDocument>): Promise<MembershipDocument | null>;
  deleteById(id: string): Promise<boolean>;
}

export const MEMBERSHIP_REPOSITORY = 'MEMBERSHIP_REPOSITORY';