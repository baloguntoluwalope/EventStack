import { Controller, Get, Param, Query, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { TournamentsService } from '../tournaments/tournaments.service';
import { FixturesService } from '../fixtures/fixtures.service';
import { MatchesService } from '../matches/matches.service';
import { StandingsService } from '../standings/standings.service';
import { KnockoutService } from '../knockout/knockout.service';
import { TeamsService } from '../teams/teams.service';
import { MatchEventsService } from '../match-events/match-events.service';
import { GroupsService } from '../groups/groups.service';


/**
 * Deliberately org-agnostic in its path — a public visitor doesn't know
 * or need an organizationId, only the tournament they're viewing. Every
 * service method below already requires organizationId internally for
 * tenant-scoped writes, but these are read-only lookups where the
 * tournament's own organizationId is resolved server-side, never trusted
 * from the request.
 */
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
    private readonly groupsService: GroupsService,
    private readonly matchEventsService: MatchEventsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('events/:eventId/tournaments')
@ApiOperation({ summary: 'Public tournaments for event' })
async getTournamentsForEvent(
  @Param('eventId') eventId: string,
) {
  return this.tournamentsService.listPublicForEvent(
    eventId,
  );
}

  @Get('tournaments/:id')
  @ApiOperation({ summary: 'Public tournament detail' })
  async getTournament(@Param('id') id: string) {
    return this.tournamentsService.findByIdPublicOrThrow(id);
  }

  @Get('tournaments/:id/fixtures')
  @ApiOperation({ summary: 'Public fixture list' })
  async getFixtures(
    @Param('id') id: string,
    @Query('groupId') groupId?: string,
    @Query('stage') stage?: string,
  ) {
    const tournament = await this.tournamentsService.findByIdPublicOrThrow(id);
    return this.fixturesService.listForTournamentPublic(
      id,
      tournament.organizationId.toString(),
      { groupId, stage },
    );
  }

  @Get('tournaments/:id/standings')
  @ApiOperation({ summary: 'Public tournament standings' })
  async getStandings(
    @Param('id') id: string,
    @Query('groupId') groupId?: string,
  ) {
    const tournament = await this.tournamentsService.findByIdPublicOrThrow(id);
    return this.standingsService.calculate(
      id,
      tournament.organizationId.toString(),
      groupId,
    );
  }

  @Get('tournaments/:id/knockout')
  @ApiOperation({ summary: 'Public knockout stage structure' })
  async getKnockout(@Param('id') id: string) {
    const tournament = await this.tournamentsService.findByIdPublicOrThrow(id);
    return this.knockoutService.listForTournament(
      id,
      tournament.organizationId.toString(),
    );
  }

  @Get('tournaments/:id/teams')
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

  @Get('matches/:id')
  @ApiOperation({ summary: 'Public match detail' })
  async getMatch(@Param('id') id: string) {
    return this.matchesService.findByIdPublicOrThrow(id);
  }

  @Sse('matches/:matchId/live')
  @ApiOperation({ summary: 'Realtime Server-Sent Events stream for match updates' })
  async live(@Param('matchId') matchId: string): Promise<Observable<MessageEvent>> {
    const match = await this.matchesService.findByIdPublicOrThrow(matchId);
    await this.tournamentsService.findByIdPublicOrThrow(match.tournamentId.toString());

    return fromEvent(this.eventEmitter, 'match.event.created').pipe(
      filter((update: any) => update.matchId === matchId),
      map((update: any) => ({ data: update }) as MessageEvent),
    );
  }

  @Get('fixtures/:id/match')
  @ApiOperation({ summary: 'Public: resolve a fixture to its live/finished match, if one exists' })
  async getMatchForFixture(@Param('id') id: string) {
    const fixture = await this.fixturesService.findByIdPublicOrThrow(id);
    await this.tournamentsService.findByIdPublicOrThrow(fixture.tournamentId.toString());
    return this.matchesService.findByFixturePublicOrNull(id);
  }


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