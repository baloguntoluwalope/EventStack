import { ClientSession } from 'mongoose';
import { MatchDocument } from '../schemas/match.schema';

export interface IMatchRepository {
  create(
    data: Partial<MatchDocument>,
    session?: ClientSession,
  ): Promise<MatchDocument>;

  findById(id: string): Promise<MatchDocument | null>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<MatchDocument | null>;

  findByFixtureForTenant(
    fixtureId: string,
    organizationId: string,
  ): Promise<MatchDocument | null>;

  findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<MatchDocument[]>;

  updateById(
    id: string,
    data: Partial<MatchDocument>,
    session?: ClientSession,
  ): Promise<MatchDocument | null>;

  findByFixturePublic(
    fixtureId: string,
  ): Promise<MatchDocument | null>;

  findByTournamentPublic(
  tournamentId: string,
): Promise<MatchDocument[]>;


}

export const MATCH_REPOSITORY = 'MATCH_REPOSITORY';