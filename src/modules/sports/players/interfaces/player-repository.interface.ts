import { PlayerDocument } from '../schemas/player.schema';

export interface IPlayerRepository {
create(
    data: Partial<PlayerDocument>,
  ): Promise<PlayerDocument>;

  findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<PlayerDocument | null>;

  findByTeamForTenant(
    teamId: string,
    organizationId: string,
  ): Promise<PlayerDocument[]>;

  updateById(
    id: string,
    data: Partial<PlayerDocument>,
  ): Promise<PlayerDocument | null>;

  deleteByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<boolean>;

  // =========================
  // PUBLIC
  // =========================

  findByIdPublic(
    id: string,
  ): Promise<PlayerDocument | null>;

  findByTeamPublic(
    teamId: string,
  ): Promise<PlayerDocument[]>;
}
export const PLAYER_REPOSITORY = 'PLAYER_REPOSITORY';

