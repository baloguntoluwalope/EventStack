import { FixtureDocument } from '../schemas/fixture.schema';

export interface FixtureFilters { groupId?: string; stage?: string; fromDate?: Date; toDate?: Date; }

export interface IFixtureRepository {
  create(data: Partial<FixtureDocument>): Promise<FixtureDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<FixtureDocument | null>;
  findByTournamentForTenant(tournamentId: string, organizationId: string, filters?: FixtureFilters): Promise<FixtureDocument[]>;
  updateById(id: string, data: Partial<FixtureDocument>): Promise<FixtureDocument | null>;
    /** PUBLIC-READ ONLY. Bypasses tenant scoping deliberately, mirroring
   * Tournament's findByIdPublic — used solely by SportsPublicController.
   * Every other consumer must keep using findByIdForTenant. */
  findByIdPublic(id: string): Promise<FixtureDocument | null>;
}
export const FIXTURE_REPOSITORY = 'FIXTURE_REPOSITORY';