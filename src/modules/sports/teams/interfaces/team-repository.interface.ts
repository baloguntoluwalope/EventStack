import { TeamDocument } from '../schemas/team.schema';

export interface ITeamRepository {
  create(data: Partial<TeamDocument>): Promise<TeamDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<TeamDocument | null>;
  findManyForTenant(organizationId: string): Promise<TeamDocument[]>;
  updateById(id: string, data: Partial<TeamDocument>): Promise<TeamDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
    /** PUBLIC-READ ONLY. Returns a name-only projection for embedding into
   * other public responses — never returns full team documents publicly. */
  findNamesByIdsPublic(ids: string[]): Promise<{ id: string; name: string; shortName?: string; logoUrl?: string }[]>;
}
export const TEAM_REPOSITORY = 'TEAM_REPOSITORY';