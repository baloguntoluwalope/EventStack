import {
  Controller,
  Get,
  Param,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
} from '@nestjs/swagger';

import {
  EventEmitter2,
} from '@nestjs/event-emitter';

import {
  Observable,
  fromEvent,
} from 'rxjs';

import {
  filter,
  map,
} from 'rxjs/operators';

import {
  TournamentsService,
} from '../tournaments/tournaments.service';

import {
  FixturesService,
} from '../fixtures/fixtures.service';

import {
  MatchesService,
} from '../matches/matches.service';

import {
  StandingsService,
} from '../standings/standings.service';

import {
  KnockoutService,
  PublicBracket,
} from '../knockout/knockout.service';

import {
  TeamsService,
} from '../teams/teams.service';

import {
  MatchEventsService,
} from '../match-events/match-events.service';

import {
  GroupsService,
} from '../groups/groups.service';

import {
  PlayersService,
} from '../players/players.service';

import {
  StatisticsService,
} from '../statistics/statistics.service';


@ApiTags('public-sports')
@Controller('public/sports')
export class SportsPublicController {
  constructor(
    private readonly tournamentsService: TournamentsService,

    private readonly fixturesService: FixturesService,

    private readonly matchesService: MatchesService,

    private readonly standingsService: StandingsService,

    private readonly knockoutService: KnockoutService,

    private readonly teamsService: TeamsService,

    private readonly playersService: PlayersService,

    private readonly groupsService: GroupsService,

    private readonly matchEventsService: MatchEventsService,

    private readonly statisticsService: StatisticsService,

    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================
  // EVENT → TOURNAMENTS
  // =========================================================

  @Get('events/:eventId/tournaments')
  @ApiOperation({
    summary: 'Public tournaments for event',
  })
  async getTournamentsForEvent(
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentsService.listPublicForEvent(
      eventId,
    );
  }

  // =========================================================
  // TOURNAMENT
  // =========================================================

  @Get('tournaments/:id')
  @ApiOperation({
    summary: 'Public tournament detail',
  })
  async getTournament(
    @Param('id') id: string,
  ) {
    return this.tournamentsService.findByIdPublicOrThrow(
      id,
    );
  }

  // =========================================================
  // FIXTURES
  // =========================================================

  @Get('tournaments/:id/fixtures')
  @ApiOperation({
    summary: 'Public fixture list',
  })
  async getFixtures(
    @Param('id') id: string,
    @Query('groupId') groupId?: string,
    @Query('stage') stage?: string,
  ) {
    const tournament =
      await this.tournamentsService.findByIdPublicOrThrow(
        id,
      );

    return this.fixturesService.listForTournamentPublic(
      id,
      tournament.organizationId.toString(),
      {
        groupId,
        stage,
      },
    );
  }

  // =========================================================
  // STANDINGS
  // =========================================================

  @Get('tournaments/:id/standings')
  @ApiOperation({
    summary: 'Public tournament standings',
  })
  async getStandings(
    @Param('id') id: string,
    @Query('groupId') groupId?: string,
  ) {
    const tournament =
      await this.tournamentsService.findByIdPublicOrThrow(
        id,
      );

    return this.standingsService.calculate(
      id,
      tournament.organizationId.toString(),
      groupId,
    );
  }

  // =========================================================
// PUBLIC KNOCKOUT ENDPOINT
//
// Replace the existing getKnockout() method in your public
// controller with this one. Add the Swagger imports and the
// PublicBracket import (adjust the path) at the top of the file:
//
//   import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
//   import { PublicBracket } from '../knockout/knockout.service';
// =========================================================

  // =========================================================
  // KNOCKOUT
  // =========================================================

  @Get('tournaments/:id/knockout')
  @ApiOperation({
    summary: 'Public knockout bracket',
    description:
      'The knockout bracket grouped by stage, in playing order. Team names are resolved, and slots ' +
      'that are still waiting show a label such as "Winner of Semi-final 1". `hasBracket` is false ' +
      'until the knockout has been generated. Internal ids (organization, tournament) are not exposed.',
  })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description:
      '{ tournamentId, hasBracket, currentStage, completed, stages: [{ stage, label, order, status, ' +
      'matches: [{ id, position, status, fixtureId, home, away, winnerGoesTo }] }] }',
  })
  async getKnockout(@Param('id') id: string): Promise<PublicBracket> {
    // Throws 404 if the tournament does not exist or is not public.
    const tournament =
      await this.tournamentsService.findByIdPublicOrThrow(id);

    // The organization comes from the tournament record, never from the
    // request, so a caller cannot read another tenant's bracket.
    return this.knockoutService.getPublicBracket(
      id,
      tournament.organizationId.toString(),
    );
  }

  // =========================================================
  // TEAMS
  // =========================================================

  @Get('tournaments/:id/teams')
  @ApiOperation({
    summary: 'Public tournament teams',
  })
  async getTeams(
    @Param('id') tournamentId: string,
  ) {
    const tournament =
      await this.tournamentsService.findByIdPublicOrThrow(
        tournamentId,
      );

    return this.teamsService.listForTournamentPublic(
      tournamentId,
      tournament.organizationId.toString(),
    );
  }

  // =========================================================
  // PLAYERS FOR TEAM
  // =========================================================

  @Get('teams/:teamId/players')
  @ApiOperation({
    summary: 'Public team player roster',
  })
  async getTeamPlayers(
    @Param('teamId') teamId: string,
  ) {
    return this.playersService.listForTeamPublic(
      teamId,
    );
  }

  // =========================================================
  // PLAYER DETAIL
  // =========================================================

  @Get('players/:id')
  @ApiOperation({
    summary: 'Public player detail',
  })
  async getPlayer(
    @Param('id') id: string,
  ) {
    return this.playersService.findByIdPublicOrThrow(
      id,
    );
  }

  // =========================================================
  // MATCH
  // =========================================================

  @Get('matches/:id')
  @ApiOperation({
    summary: 'Public match detail',
  })
  async getMatch(
    @Param('id') id: string,
  ) {
    return this.matchesService.findByIdPublicOrThrow(
      id,
    );
  }

  // =========================================================
  // LIVE MATCH SSE
  // =========================================================

  @Sse('matches/:matchId/live')
  @ApiOperation({
    summary:
      'Realtime Server-Sent Events stream for match updates',
  })
  async live(
    @Param('matchId') matchId: string,
  ): Promise<Observable<MessageEvent>> {
    const match =
      await this.matchesService.findByIdPublicOrThrow(
        matchId,
      );

    await this.tournamentsService.findByIdPublicOrThrow(
      match.tournamentId.toString(),
    );

    return fromEvent(
      this.eventEmitter,
      'match.event.created',
    ).pipe(
      filter(
        (update: any) =>
          update.matchId === matchId,
      ),
      map(
        (update: any) =>
          ({
            data: update,
          }) as MessageEvent,
      ),
    );
  }

  // =========================================================
  // FIXTURE → MATCH
  // =========================================================

  @Get('fixtures/:id/match')
  @ApiOperation({
    summary:
      'Public: resolve a fixture to its live/finished match',
  })
  async getMatchForFixture(
    @Param('id') id: string,
  ) {
    const fixture =
      await this.fixturesService.findByIdPublicOrThrow(
        id,
      );

    await this.tournamentsService.findByIdPublicOrThrow(
      fixture.tournamentId.toString(),
    );

    return this.matchesService.findByFixturePublicOrNull(
      id,
    );
  }

  // =========================================================
  // MATCH EVENTS
  // =========================================================

  @Get('matches/:matchId/events')
  @ApiOperation({
    summary: 'Public match event timeline',
  })
  async getMatchEvents(
    @Param('matchId') matchId: string,
  ) {
    return this.matchEventsService.listForMatchPublic(
      matchId,
    );
  }

 // =========================================================
// MATCH STATISTICS
// =========================================================

@Get('matches/:matchId/statistics')
@ApiOperation({
  summary: 'Public match statistics',
})
async getMatchStatistics(
  @Param('matchId') matchId: string,
) {
  const match =
    await this.matchesService.findByIdPublicOrThrow(
      matchId,
    );

  // Keep statistics tenant-scoped using the
  // organization that owns the match.
  const organizationId =
    match.organizationId.toString();

  // Verify that the match belongs to a publicly
  // accessible tournament.
  await this.tournamentsService.findByIdPublicOrThrow(
    match.tournamentId.toString(),
  );

  return this.statisticsService.getMatchStatistics(
    matchId,
    organizationId,
  );
}

  // =========================================================
  // GROUPS
  // =========================================================

  @Get('tournaments/:id/groups')
  @ApiOperation({
    summary: 'Public tournament groups',
  })
  async getGroups(
    @Param('id') id: string,
  ) {
    const tournament =
      await this.tournamentsService.findByIdPublicOrThrow(
        id,
      );

    return this.groupsService.listPublicForTournament(
      id,
      tournament.organizationId.toString(),
    );
  }
}