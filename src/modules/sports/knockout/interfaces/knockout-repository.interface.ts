import { KnockoutStageDocument } from '../schemas/knockout-stage.schema';
import { KnockoutMatchDocument } from '../schemas/knockout-match.schema';

// =========================================================
// STAGE REPOSITORY
// =========================================================

export interface IKnockoutStageRepository {
  create(data: Partial<KnockoutStageDocument>): Promise<KnockoutStageDocument>;

  /** Returns the tournament's stages sorted by `order` ascending. */
  findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutStageDocument[]>;

  findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutStageDocument | null>;

  /**
   * The next stage that exists for this tournament, i.e. the one with
   * the smallest `order` greater than `currentOrder`. Null when the
   * current stage is the last one.
   */
  findNextStageForTenant(
    tournamentId: string,
    organizationId: string,
    currentOrder: number,
  ): Promise<KnockoutStageDocument | null>;

  updateById(
    id: string,
    data: Partial<KnockoutStageDocument>,
  ): Promise<KnockoutStageDocument | null>;
}

export const KNOCKOUT_STAGE_REPOSITORY = 'KNOCKOUT_STAGE_REPOSITORY';

// =========================================================
// MATCH REPOSITORY
// =========================================================

export interface IKnockoutMatchRepository {
  create(data: Partial<KnockoutMatchDocument>): Promise<KnockoutMatchDocument>;

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

  /** Used when a fixture finishes to find the knockout match it belongs to. */
  findByFixtureForTenant(
    fixtureId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument | null>;

  updateById(
    id: string,
    data: Partial<KnockoutMatchDocument>,
  ): Promise<KnockoutMatchDocument | null>;
}

export const KNOCKOUT_MATCH_REPOSITORY = 'KNOCKOUT_MATCH_REPOSITORY';


// import {
//   KnockoutStageDocument,
// } from '../schemas/knockout-stage.schema';

// import {
//   KnockoutMatchDocument,
// } from '../schemas/knockout-match.schema';

// // =========================================================
// // STAGE REPOSITORY
// // =========================================================

// export interface IKnockoutStageRepository {
//   create(
//     data: Partial<KnockoutStageDocument>,
//   ): Promise<KnockoutStageDocument>;

//   findByTournamentForTenant(
//     tournamentId: string,
//     organizationId: string,
//   ): Promise<KnockoutStageDocument[]>;

//   findByStageForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//   ): Promise<KnockoutStageDocument | null>;

//   updateById(
//     id: string,
//     data: Partial<KnockoutStageDocument>,
//   ): Promise<KnockoutStageDocument | null>;
// }

// export const KNOCKOUT_STAGE_REPOSITORY =
//   'KNOCKOUT_STAGE_REPOSITORY';

// // =========================================================
// // MATCH REPOSITORY
// // =========================================================

// export interface IKnockoutMatchRepository {
//   create(
//     data: Partial<KnockoutMatchDocument>,
//   ): Promise<KnockoutMatchDocument>;

//   findByIdForTenant(
//     id: string,
//     organizationId: string,
//   ): Promise<KnockoutMatchDocument | null>;

//   findByTournamentForTenant(
//     tournamentId: string,
//     organizationId: string,
//   ): Promise<KnockoutMatchDocument[]>;

//   findByStageForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//   ): Promise<KnockoutMatchDocument[]>;

//   findByPositionForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//     position: number,
//   ): Promise<KnockoutMatchDocument | null>;

//   findByFixtureForTenant(
//     fixtureId: string,
//     organizationId: string,
//   ): Promise<KnockoutMatchDocument | null>;

//   updateById(
//     id: string,
//     data: Partial<KnockoutMatchDocument>,
//   ): Promise<KnockoutMatchDocument | null>;
// }

// export const KNOCKOUT_MATCH_REPOSITORY =
//   'KNOCKOUT_MATCH_REPOSITORY';