import { GroupDocument } from '../schemas/group.schema';

export interface IGroupRepository {
  create(data: Partial<GroupDocument>): Promise<GroupDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<GroupDocument | null>;
  findByTournamentForTenant(tournamentId: string, organizationId: string): Promise<GroupDocument[]>;
  updateById(id: string, data: Partial<GroupDocument>): Promise<GroupDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
}
export const GROUP_REPOSITORY = 'GROUP_REPOSITORY';