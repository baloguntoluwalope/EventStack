import {
  Injectable,
} from '@nestjs/common';

import {
  MatchesService,
} from '../matches/matches.service';

import {
  FixturesService,
} from '../fixtures/fixtures.service';

import {
  TournamentsService,
} from '../tournaments/tournaments.service';

import {
  TeamsService,
} from '../teams/teams.service';

import {
  MatchStatus,
  MatchResult,
} from '../matches/schemas/match.schema';

import {
  resolveStandings,
  BaseStandingRow,
} from './tie-break-resolver';

export interface StandingRow
  extends BaseStandingRow {
  teamName?: string;
  teamLogoUrl?: string | null;

  played: number;
  wins: number;
  draws: number;
  losses: number;

  goalsFor: number;
  goalsAgainst: number;

  live?: boolean;

  groupId?: string | null;
  groupName?: string | null;
}

const INCLUDED_MATCH_STATUSES = [
  MatchStatus.LIVE,
  MatchStatus.HALFTIME,
  MatchStatus.EXTRA_TIME,
  MatchStatus.PENALTIES,
  MatchStatus.FINISHED,
];

@Injectable()
export class StandingsService {
  constructor(
    private readonly tournamentsService: TournamentsService,

    private readonly fixturesService: FixturesService,

    private readonly matchesService: MatchesService,

    private readonly teamsService: TeamsService,
  ) {}

  // =========================================================
  // CALCULATE STANDINGS
  // =========================================================

  async calculate(
    tournamentId: string,
    organizationId: string,
    groupId?: string,
  ): Promise<StandingRow[]> {
    const tournament =
      await this.tournamentsService.findByIdOrThrow(
        tournamentId,
        organizationId,
      );

    // -------------------------------------------------------
    // LOAD TOURNAMENT REGISTRATIONS
    // -------------------------------------------------------

    /*
     * IMPORTANT:
     *
     * Group membership comes from TeamRegistration.groupId.
     *
     * We DO NOT derive group membership from fixtures.
     *
     * This means:
     *
     * Team assigned to Group A
     *        ↓
     * Standing row immediately exists
     *        ↓
     * P 0 | W 0 | D 0 | L 0 | GF 0 | GA 0 | GD 0 | Pts 0
     *
     * Fixtures and matches only affect the statistics.
     */
    const registrations =
      await this.teamsService.listRegistrations(
        organizationId,
        tournamentId,
      );

    // -------------------------------------------------------
    // FIND TEAMS BELONGING TO SELECTED GROUP
    // -------------------------------------------------------

    const eligibleTeamIds =
      groupId
        ? new Set<string>(
            registrations
              .filter(
                (registration: any) => {
                  if (
                    registration.status !==
                    'registered'
                  ) {
                    return false;
                  }

                  const registrationGroupId =
                    this.getReferencedId(
                      registration.groupId,
                    );

                  return (
                    registrationGroupId ===
                    String(groupId)
                  );
                },
              )
              .map(
                (registration: any) =>
                  this.getReferencedId(
                    registration.teamId,
                  ),
              )
              .filter(Boolean),
          )
        : new Set<string>(
            registrations
              .filter(
                (registration: any) =>
                  registration.status ===
                  'registered',
              )
              .map(
                (registration: any) =>
                  this.getReferencedId(
                    registration.teamId,
                  ),
              )
              .filter(Boolean),
          );

    // -------------------------------------------------------
    // REGISTERED TEAM DOCUMENTS
    // -------------------------------------------------------

    const registeredTeams =
      await this.teamsService.listForTournament(
        organizationId,
        tournamentId,
      );

    const table =
      new Map<
        string,
        StandingRow
      >();

    // -------------------------------------------------------
    // PRE-POPULATE EVERY TEAM
    // -------------------------------------------------------

    /*
     * This is the important part.
     *
     * Every team assigned to the selected group receives
     * a standing row BEFORE we look at matches.
     */
    for (
      const team of registeredTeams
    ) {
      const teamId =
        String(team.id);

      if (
        !eligibleTeamIds.has(teamId)
      ) {
        continue;
      }

      table.set(
        teamId,
        {
          teamId,

          teamName:
            team.name ??
            'Unknown Team',

          teamLogoUrl:
            team.logoUrl ??
            null,

          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,

          goalsFor: 0,
          goalsAgainst: 0,

          goalDifference: 0,
          points: 0,

          live: false,

          groupId:
            groupId ??
            null,

          groupName:
            undefined,
        },
      );
    }

    // -------------------------------------------------------
    // ALL MATCHES
    // -------------------------------------------------------

    const matches =
      await this.matchesService.listForTournament(
        tournamentId,
        organizationId,
      );

    const eligibleMatches =
      matches.filter(
        (match) =>
          INCLUDED_MATCH_STATUSES.includes(
            match.status,
          ),
      );

    // -------------------------------------------------------
    // GROUP FIXTURES
    // -------------------------------------------------------

    let relevantMatches =
      eligibleMatches;

    if (groupId) {
      /*
       * Match statistics still come from matches.
       *
       * We use the fixture's groupId to determine which
       * matches belong to the selected group.
       */
      const groupFixtures =
        await this.fixturesService.listForTournament(
          tournamentId,
          organizationId,
          {
            groupId,
          },
        );

      const fixtureIds =
        new Set(
          groupFixtures.map(
            (fixture) =>
              String(
                fixture.id,
              ),
          ),
        );

      relevantMatches =
        eligibleMatches.filter(
          (match) =>
            fixtureIds.has(
              String(
                match.fixtureId,
              ),
            ),
        );
    }

    // -------------------------------------------------------
    // SCORING RULES
    // -------------------------------------------------------

    const winPoints =
      tournament.scoringRules
        ?.winPoints ??
      3;

    const drawPoints =
      tournament.scoringRules
        ?.drawPoints ??
      1;

    const lossPoints =
      tournament.scoringRules
        ?.lossPoints ??
      0;

    // -------------------------------------------------------
    // ENSURE TEAM ROW
    // -------------------------------------------------------

    const ensure = (
      teamId: string,
    ): StandingRow => {
      if (!table.has(teamId)) {
        table.set(
          teamId,
          {
            teamId,

            teamName:
              'Unknown Team',

            teamLogoUrl:
              null,

            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,

            goalsFor: 0,
            goalsAgainst: 0,

            goalDifference: 0,
            points: 0,

            live: false,

            groupId:
              groupId ??
              null,

            groupName:
              undefined,
          },
        );
      }

      return table.get(
        teamId,
      )!;
    };

    // -------------------------------------------------------
    // ACCUMULATE MATCHES
    // -------------------------------------------------------

    for (
      const match of relevantMatches
    ) {
      const homeId =
        String(
          match.homeTeamId,
        );

      const awayId =
        String(
          match.awayTeamId,
        );

      /*
       * Only calculate matches involving teams that
       * actually belong to this group.
       */
      if (
        !eligibleTeamIds.has(
          homeId,
        ) ||
        !eligibleTeamIds.has(
          awayId,
        )
      ) {
        continue;
      }

      const home =
        ensure(homeId);

      const away =
        ensure(awayId);

      const homeScore =
        Number(
          match.homeScore ?? 0,
        );

      const awayScore =
        Number(
          match.awayScore ?? 0,
        );

      // -----------------------------------------------------
      // LIVE FLAG
      // -----------------------------------------------------

      const isLive =
        match.status !==
        MatchStatus.FINISHED;

      if (isLive) {
        home.live = true;
        away.live = true;
      }

      // -----------------------------------------------------
      // PLAYED
      // -----------------------------------------------------

      /*
       * Started matches count as played for provisional
       * live standings.
       */
      home.played += 1;
      away.played += 1;

      // -----------------------------------------------------
      // GOALS
      // -----------------------------------------------------

      home.goalsFor +=
        homeScore;

      home.goalsAgainst +=
        awayScore;

      away.goalsFor +=
        awayScore;

      away.goalsAgainst +=
        homeScore;

      // -----------------------------------------------------
      // RESULT
      // -----------------------------------------------------

      let result:
        | MatchResult
        | null = null;

      if (
        match.status ===
          MatchStatus.FINISHED &&
        match.result
      ) {
        result =
          match.result;
      } else if (
        homeScore >
        awayScore
      ) {
        result =
          MatchResult.HOME_WIN;
      } else if (
        awayScore >
        homeScore
      ) {
        result =
          MatchResult.AWAY_WIN;
      } else {
        result =
          MatchResult.DRAW;
      }

      // -----------------------------------------------------
      // APPLY RESULT
      // -----------------------------------------------------

      if (
        result ===
        MatchResult.HOME_WIN
      ) {
        home.wins += 1;
        home.points +=
          winPoints;

        away.losses += 1;
        away.points +=
          lossPoints;
      }

      if (
        result ===
        MatchResult.AWAY_WIN
      ) {
        away.wins += 1;
        away.points +=
          winPoints;

        home.losses += 1;
        home.points +=
          lossPoints;
      }

      if (
        result ===
        MatchResult.DRAW
      ) {
        home.draws += 1;
        away.draws += 1;

        home.points +=
          drawPoints;

        away.points +=
          drawPoints;
      }
    }

    // -------------------------------------------------------
    // METADATA
    // -------------------------------------------------------

    const teamIds =
      Array.from(
        table.keys(),
      );

    const nameMap =
      await this.teamsService.getPublicNamesMap(
        teamIds,
      );

    const rows =
      Array.from(
        table.values(),
      ).map(
        (row) => ({
          ...row,

          goalDifference:
            row.goalsFor -
            row.goalsAgainst,

          teamName:
            nameMap[row.teamId]
              ?.name ??
            row.teamName,

          teamLogoUrl:
            nameMap[row.teamId]
              ?.logoUrl ??
            row.teamLogoUrl,
        }),
      );

    // -------------------------------------------------------
    // TIE BREAKS
    // -------------------------------------------------------

    const tieBreakRules = [
      'points',

      ...(
        tournament.tieBreakRules ??
        [
          'goalDifference',
          'goalsFor',
        ]
      ),
    ];

    return resolveStandings(
      rows,
      tieBreakRules,
    );
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private getReferencedId(
    value: any,
  ): string {
    if (!value) {
      return '';
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return String(value);
    }

    if (value._id) {
      return String(value._id);
    }

    if (value.id) {
      return String(value.id);
    }

    return String(value);
  }
}