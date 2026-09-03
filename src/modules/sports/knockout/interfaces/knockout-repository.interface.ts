import { KnockoutStageDocument } from '../schemas/knockout-stage.schema';
import { KnockoutMatchDocument } from '../schemas/knockout-match.schema';

export interface IKnockoutStageRepository {
  create(
    data: Partial<KnockoutStageDocument>,
  ): Promise<KnockoutStageDocument>;

  findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutStageDocument[]>;

  findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutStageDocument | null>;

  updateById(
    id: string,
    data: Partial<KnockoutStageDocument>,
  ): Promise<KnockoutStageDocument | null>;
}

export const KNOCKOUT_STAGE_REPOSITORY =
  'KNOCKOUT_STAGE_REPOSITORY';


export interface IKnockoutMatchRepository {
  create(
    data: Partial<KnockoutMatchDocument>,
  ): Promise<KnockoutMatchDocument>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument | null>;

  findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument[]>;

  findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutMatchDocument[]>;

  findByPositionForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
    position: number,
  ): Promise<KnockoutMatchDocument | null>;

  findByFixtureForTenant(
    fixtureId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument | null>;

  updateById(
    id: string,
    data: Partial<KnockoutMatchDocument>,
  ): Promise<KnockoutMatchDocument | null>;
}

export const KNOCKOUT_MATCH_REPOSITORY =
  'KNOCKOUT_MATCH_REPOSITORY';