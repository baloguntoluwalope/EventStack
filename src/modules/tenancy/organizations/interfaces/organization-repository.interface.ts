import { OrganizationDocument } from '../schemas/organization.schema';

export interface IOrganizationRepository {
  create(data: Partial<OrganizationDocument>): Promise<OrganizationDocument>;
  findById(id: string): Promise<OrganizationDocument | null>;
  updateById(id: string, data: Partial<OrganizationDocument>): Promise<OrganizationDocument | null>;
  deleteById(id: string): Promise<boolean>;
  count(filter?: Record<string, any>): Promise<number>;
}

export const ORGANIZATION_REPOSITORY = 'ORGANIZATION_REPOSITORY';