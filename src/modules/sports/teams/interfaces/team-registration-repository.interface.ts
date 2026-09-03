import { TeamRegistrationDocument } from '../schemas/team-registration.schema';

export interface ITeamRegistrationRepository {
  create(data: Partial<TeamRegistrationDocument>): Promise<TeamRegistrationDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<TeamRegistrationDocument | null>;
  findByTournamentForTenant(tournamentId: string, organizationId: string): Promise<TeamRegistrationDocument[]>;
  updateById(id: string, data: Partial<TeamRegistrationDocument>): Promise<TeamRegistrationDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
}
export const TEAM_REGISTRATION_REPOSITORY = 'TEAM_REGISTRATION_REPOSITORY';