import { ClientSession } from 'mongoose';
import { MatchEventDocument } from '../schemas/match-event.schema';

export interface IMatchEventRepository {
  create(data: Partial<MatchEventDocument>, session?: ClientSession): Promise<MatchEventDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<MatchEventDocument | null>;
  findByMatchForTenant(matchId: string, organizationId: string): Promise<MatchEventDocument[]>;
  findByIdempotencyKey(matchId: string, idempotencyKey: string): Promise<MatchEventDocument | null>;
  findActiveGoalsForMatch(matchId: string, session?: ClientSession): Promise<MatchEventDocument[]>;
  updateById(id: string, data: Partial<MatchEventDocument>, session?: ClientSession): Promise<MatchEventDocument | null>;
  withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>;
  findActiveForMatch(
  matchId: string,
  organizationId: string,
): Promise<any[]>;
findByMatchPublic(
  matchId: string,
): Promise<MatchEventDocument[]>;
}
export const MATCH_EVENT_REPOSITORY = 'MATCH_EVENT_REPOSITORY';