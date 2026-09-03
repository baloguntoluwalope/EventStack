import { ClientSession } from 'mongoose';

import {
  TournamentDocument,
} from '../schemas/tournament.schema';

export interface ITournamentRepository {
  create(
    data: Partial<TournamentDocument>,
    session?: ClientSession,
  ): Promise<TournamentDocument>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<TournamentDocument | null>;

  findByEventForTenant(
    eventId: string,
    organizationId: string,
  ): Promise<TournamentDocument[]>;

  findByEventPublic(
    eventId: string,
  ): Promise<TournamentDocument[]>;

  updateById(
    id: string,
    data: Partial<TournamentDocument>,
  ): Promise<TournamentDocument | null>;

  deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean>;

  findByIdPublic(
    id: string,
  ): Promise<TournamentDocument | null>;
}

export const TOURNAMENT_REPOSITORY =
  'TOURNAMENT_REPOSITORY';