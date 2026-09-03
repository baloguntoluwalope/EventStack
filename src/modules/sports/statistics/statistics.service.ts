import {
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  IMatchEventRepository,
  MATCH_EVENT_REPOSITORY,
} from '../match-events/interfaces/match-event-repository.interface';

import {
  MatchEventType,
} from '../match-events/schemas/match-event.schema';

import {
  MatchStatisticsDto,
  PlayerMatchStatisticsDto,
  TeamMatchStatisticsDto,
} from './dto/match-statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @Inject(MATCH_EVENT_REPOSITORY)
    private readonly eventRepo: IMatchEventRepository,
  ) {}

  async getMatchStatistics(
    matchId: string,
    organizationId: string,
  ): Promise<MatchStatisticsDto> {
    const events =
      await this.eventRepo.findActiveForMatch(
        matchId,
        organizationId,
      );

    const players = new Map<
      string,
      PlayerMatchStatisticsDto
    >();

    const teams = new Map<
      string,
      TeamMatchStatisticsDto
    >();

    const getPlayer = (
      playerId: string,
      teamId: string,
    ) => {
      const key = `${teamId}:${playerId}`;

      let player = players.get(key);

      if (!player) {
        player = {
          playerId,
          teamId,
          goals: 0,
          assists: 0,
          ownGoals: 0,
          yellowCards: 0,
          redCards: 0,
        };

        players.set(key, player);
      }

      return player;
    };

    const getTeam = (
      teamId: string,
    ) => {
      let team = teams.get(teamId);

      if (!team) {
        team = {
          teamId,
          goals: 0,
          ownGoals: 0,
          yellowCards: 0,
          redCards: 0,
          players: [],
        };

        teams.set(teamId, team);
      }

      return team;
    };

    for (const event of events) {
      if (!event.teamId) {
        continue;
      }

      const teamId =
        event.teamId.toString();

      const team = getTeam(teamId);

      // ==========================================
      // GOAL
      // ==========================================

      if (
        event.type ===
        MatchEventType.GOAL
      ) {
        team.goals += 1;

        if (event.playerId) {
          const player =
            getPlayer(
              event.playerId.toString(),
              teamId,
            );

          player.goals += 1;

          // secondaryPlayerId = assister
          if (
            event.secondaryPlayerId
          ) {
            const assister =
              getPlayer(
                event.secondaryPlayerId.toString(),
                teamId,
              );

            assister.assists += 1;
          }
        }

        continue;
      }

      // ==========================================
      // OWN GOAL
      // ==========================================

      if (
        event.type ===
        MatchEventType.OWN_GOAL
      ) {
        team.ownGoals += 1;

        if (event.playerId) {
          const player =
            getPlayer(
              event.playerId.toString(),
              teamId,
            );

          player.ownGoals += 1;
        }

        continue;
      }

      // ==========================================
      // YELLOW CARD
      // ==========================================

      if (
        event.type ===
        MatchEventType.YELLOW_CARD
      ) {
        if (event.playerId) {
          const player =
            getPlayer(
              event.playerId.toString(),
              teamId,
            );

          player.yellowCards += 1;

          team.yellowCards += 1;
        }

        continue;
      }

      // ==========================================
      // SECOND YELLOW
      // ==========================================

      if (
        event.type ===
        MatchEventType.SECOND_YELLOW
      ) {
        if (event.playerId) {
          const player =
            getPlayer(
              event.playerId.toString(),
              teamId,
            );

          player.yellowCards += 1;

          team.yellowCards += 1;
        }

        continue;
      }

      // ==========================================
      // RED CARD
      // ==========================================

      if (
        event.type ===
        MatchEventType.RED_CARD
      ) {
        if (event.playerId) {
          const player =
            getPlayer(
              event.playerId.toString(),
              teamId,
            );

          player.redCards += 1;

          team.redCards += 1;
        }
      }
    }

    // Attach players to teams
    for (const player of players.values()) {
      const team = teams.get(
        player.teamId,
      );

      if (team) {
        team.players.push(player);
      }
    }

    return {
      matchId,
      players: Array.from(
        players.values(),
      ),
      teams: Array.from(
        teams.values(),
      ),
    };
  }
}