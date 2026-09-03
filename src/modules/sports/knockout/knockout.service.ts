import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import {
  IKnockoutStageRepository,
  KNOCKOUT_STAGE_REPOSITORY,
  IKnockoutMatchRepository,
  KNOCKOUT_MATCH_REPOSITORY,
} from './interfaces/knockout-repository.interface';

import {
  KnockoutMatchStatus,
  KnockoutMatchDocument,
} from './schemas/knockout-match.schema';

import {
  KnockoutStageStatus,
} from './schemas/knockout-stage.schema';

import {
  CreateKnockoutBracketDto,
} from './dto/create-knockout-bracket.dto';

import {
  GenerateBracketDto,
} from './dto/generate-bracket.dto';

import {
  FixturesService,
} from '../fixtures/fixtures.service';

import {
  TeamSlotType,
  FixtureStage,
} from '../fixtures/schemas/fixture.schema';

import {
  GroupsService,
} from '../groups/groups.service';

import {
  StandingsService,
} from '../standings/standings.service';

import {
  MatchResult,
} from '../matches/schemas/match.schema';

interface MatchFinishedPayload {
  matchId: string;
  fixtureId: string;
  tournamentId: string;
  organizationId: string;
  homeTeamId: string;
  awayTeamId: string;
  result: MatchResult;
}

@Injectable()
export class KnockoutService {
  private readonly logger = new Logger(
    KnockoutService.name,
  );

  constructor(
    @Inject(KNOCKOUT_STAGE_REPOSITORY)
    private readonly stageRepo: IKnockoutStageRepository,

    @Inject(KNOCKOUT_MATCH_REPOSITORY)
    private readonly knockoutMatchRepo: IKnockoutMatchRepository,

    private readonly fixturesService: FixturesService,
  ) {}

  // =========================================================
  // CREATE BRACKET
  // =========================================================

  async createBracket(
    tournamentId: string,
    organizationId: string,
    dto: CreateKnockoutBracketDto,
  ) {
    if (!dto.matches?.length) {
      throw new BadRequestException(
        'At least one knockout match is required.',
      );
    }

    const existing =
      await this.knockoutMatchRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    if (existing.length > 0) {
      throw new BadRequestException(
        'A knockout bracket already exists for this tournament.',
      );
    }

    /*
     * Create each stage only once.
     */
    const stageMap = new Map<string, any>();

    for (const match of dto.matches) {
      if (!stageMap.has(match.stage)) {
        const stage =
          await this.stageRepo.create({
            tournamentId:
              tournamentId as any,

            organizationId:
              organizationId as any,

            stage:
              match.stage,

            order:
              this.getStageOrder(
                match.stage,
              ),

            status:
              KnockoutStageStatus.PENDING,
          });

        stageMap.set(
          match.stage,
          stage,
        );
      }
    }

    const created: KnockoutMatchDocument[] =
      [];

    /*
     * Create every knockout match first.
     *
     * This allows later matches to reference
     * unresolved winners.
     */
    for (const match of dto.matches) {
      const knockoutMatch =
        await this.knockoutMatchRepo.create({
          tournamentId:
            tournamentId as any,

          organizationId:
            organizationId as any,

          stage:
            match.stage,

          position:
            match.position,

          homeSource:
            match.homeSource as any,

          awaySource:
            match.awaySource as any,

          fixtureId:
            null,

          winnerFeedsToStage:
            match.winnerFeedsToStage ??
            null,

          winnerFeedsToPosition:
            match.winnerFeedsToPosition ??
            null,

          loserFeedsToStage:
            match.loserFeedsToStage ??
            null,

          loserFeedsToPosition:
            match.loserFeedsToPosition ??
            null,

          status:
            KnockoutMatchStatus.PENDING,
        });

      created.push(
        knockoutMatch,
      );
    }

    /*
     * Try to resolve matches immediately.
     *
     * Fixed-vs-fixed matches become READY
     * and receive their fixture immediately.
     */
    for (const match of created) {
      await this.tryResolveAndCreateFixture(
        match,
        tournamentId,
        organizationId,
      );
    }

    return this.knockoutMatchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );
  }

  // =========================================================
  // LIST BRACKET
  // =========================================================

  async listForTournament(
    tournamentId: string,
    organizationId: string,
  ) {
    const matches =
      await this.knockoutMatchRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    return matches.sort(
      (a, b) => {
        const stageDifference =
          this.getStageOrder(
            a.stage,
          ) -
          this.getStageOrder(
            b.stage,
          );

        if (stageDifference !== 0) {
          return stageDifference;
        }

        return (
          a.position -
          b.position
        );
      },
    );
  }

  // =========================================================
  // RESOLVE MATCH + CREATE FIXTURE
  // =========================================================

  private async tryResolveAndCreateFixture(
    km: KnockoutMatchDocument,
    tournamentId: string,
    organizationId: string,
  ) {
    if (!km) {
      return;
    }

    /*
     * Fixture already exists.
     */
    if (km.fixtureId) {
      return;
    }

    const homeReady =
      km.homeSource?.type ===
        TeamSlotType.FIXED &&
      !!km.homeSource?.teamId;

    const awayReady =
      km.awaySource?.type ===
        TeamSlotType.FIXED &&
      !!km.awaySource?.teamId;

    /*
     * Both teams must be resolved before
     * a real fixture can be created.
     */
    if (
      !homeReady ||
      !awayReady
    ) {
      return;
    }

    const fixture =
      await this.fixturesService.create(
        tournamentId,
        organizationId,
        {
          stage:
            km.stage,

          homeSlot:
            km.homeSource,

          awaySlot:
            km.awaySource,

          scheduledAt:
            new Date().toISOString(),
        } as any,
      );

    await this.knockoutMatchRepo.updateById(
      km.id,
      {
        fixtureId:
          fixture.id as any,

        status:
          KnockoutMatchStatus.READY,
      },
    );

    this.logger.log(
      `Created fixture ${fixture.id} for knockout match ${km.id}`,
    );
  }

  // =========================================================
  // MATCH FINISHED
  // =========================================================

  @OnEvent('match.finished')
  async handleMatchFinished(
    payload: MatchFinishedPayload,
  ) {
    const knockoutMatch =
      await this.knockoutMatchRepo.findByFixtureForTenant(
        payload.fixtureId,
        payload.organizationId,
      );

    /*
     * Normal group-stage match.
     */
    if (!knockoutMatch) {
      return;
    }

    /*
     * Protect against duplicate events.
     */
    if (
      knockoutMatch.status ===
      KnockoutMatchStatus.COMPLETED
    ) {
      this.logger.warn(
        `Knockout match ${knockoutMatch.id} already completed.`,
      );

      return;
    }

    let winnerId:
      | string
      | null = null;

    let loserId:
      | string
      | null = null;

    if (
      payload.result ===
      MatchResult.HOME_WIN
    ) {
      winnerId =
        payload.homeTeamId;

      loserId =
        payload.awayTeamId;
    }

    if (
      payload.result ===
      MatchResult.AWAY_WIN
    ) {
      winnerId =
        payload.awayTeamId;

      loserId =
        payload.homeTeamId;
    }

    /*
     * Knockout matches cannot finish as
     * undecided draws.
     */
    if (!winnerId) {
      this.logger.warn(
        `Knockout match ${knockoutMatch.id} finished without a winner.`,
      );

      return;
    }

    await this.knockoutMatchRepo.updateById(
      knockoutMatch.id,
      {
        status:
          KnockoutMatchStatus.COMPLETED,
      },
    );

    /*
     * Feed winner forward.
     */
    if (
      knockoutMatch.winnerFeedsToStage &&
      knockoutMatch.winnerFeedsToPosition !=
        null
    ) {
      await this.resolveSlotInto(
        knockoutMatch.winnerFeedsToStage,
        knockoutMatch.winnerFeedsToPosition,
        'winner',
        winnerId,
        payload.tournamentId,
        payload.organizationId,
      );
    }

    /*
     * Feed loser forward when the bracket
     * supports it.
     */
    if (
      knockoutMatch.loserFeedsToStage &&
      knockoutMatch.loserFeedsToPosition !=
        null &&
      loserId
    ) {
      await this.resolveSlotInto(
        knockoutMatch.loserFeedsToStage,
        knockoutMatch.loserFeedsToPosition,
        'loser',
        loserId,
        payload.tournamentId,
        payload.organizationId,
      );
    }
  }

  // =========================================================
  // RESOLVE WINNER / LOSER INTO TARGET
  // =========================================================

  private async resolveSlotInto(
    targetStage: string,
    targetPosition: number,
    sourceType:
      | 'winner'
      | 'loser',
    resolvedTeamId: string,
    tournamentId: string,
    organizationId: string,
  ) {
    const matches =
      await this.knockoutMatchRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    const target =
      matches.find(
        (match) =>
          match.stage ===
            targetStage &&
          match.position ===
            targetPosition,
      );

    if (!target) {
      this.logger.error(
        `Could not find knockout target ${targetStage}:${targetPosition}`,
      );

      return;
    }

    /*
     * A waiting source is represented by
     * match_winner / match_loser.
     */
    const homeWaiting =
      target.homeSource?.type ===
        'match_winner' ||
      target.homeSource?.type ===
        'match_loser';

    const awayWaiting =
      target.awaySource?.type ===
        'match_winner' ||
      target.awaySource?.type ===
        'match_loser';

    let field:
      | 'homeSource'
      | 'awaySource'
      | null = null;

    /*
     * If the home slot is waiting and unresolved,
     * use it first.
     */
    if (
      homeWaiting &&
      !target.homeSource.teamId
    ) {
      field =
        'homeSource';
    } else if (
      awayWaiting &&
      !target.awaySource.teamId
    ) {
      field =
        'awaySource';
    }

    if (!field) {
      return;
    }

    const existingSource =
      field === 'homeSource'
        ? target.homeSource
        : target.awaySource;

    await this.knockoutMatchRepo.updateById(
      target.id,
      {
        [field]: {
          type:
            existingSource.type,

          teamId:
            resolvedTeamId,
        },
      } as any,
    );

    const refreshed =
      await this.knockoutMatchRepo.findByIdForTenant(
        target.id,
        organizationId,
      );

    if (!refreshed) {
      return;
    }

    await this.tryResolveAndCreateFixture(
      refreshed,
      tournamentId,
      organizationId,
    );
  }

  // =========================================================
  // GENERATE FROM STANDINGS
  // =========================================================

 // =========================================================
// GENERATE 12-TEAM / 3-GROUP KNOCKOUT
// =========================================================

async generateFromStandings(
  tournamentId: string,
  organizationId: string,
  firstKnockoutStage: string,
  dto: GenerateBracketDto,
  groupsService: GroupsService,
  standingsService: StandingsService,
) {
  const groups =
    await groupsService.listForTournament(
      tournamentId,
      organizationId,
    );

  if (groups.length !== 3) {
    throw new BadRequestException(
      `This knockout format requires exactly 3 groups. Found ${groups.length}.`,
    );
  }

  /*
   * Prevent accidentally creating a second bracket.
   */
  const existing =
    await this.knockoutMatchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );

  if (existing.length) {
    throw new BadRequestException(
      'A knockout bracket already exists for this tournament.',
    );
  }

  // =======================================================
  // CALCULATE STANDINGS FOR EACH GROUP
  // =======================================================

  const groupData: {
    group: any;
    standings: any[];
  }[] = [];

  for (const group of groups) {
    const standings =
      await standingsService.calculate(
        tournamentId,
        organizationId,
        group.id,
      );

    if (!standings || standings.length < 3) {
      throw new BadRequestException(
        `Group ${group.id} does not have enough teams to determine the top three.`,
      );
    }

    groupData.push({
      group,
      standings,
    });
  }

  // =======================================================
  // QUALIFICATION
  //
  // 3 GROUP WINNERS
  // 3 GROUP RUNNERS-UP
  // 2 BEST THIRD-PLACED TEAMS
  //
  // TOTAL = 8
  // =======================================================

  const groupWinners: string[] = [];
  const groupRunnersUp: string[] = [];

  const thirdPlaced: {
    groupId: string;
    teamId: string;
    points: number;
    goalDifference: number;
    goalsScored: number;
  }[] = [];

  for (const { group, standings } of groupData) {
    const first = standings[0];
    const second = standings[1];
    const third = standings[2];

    if (!first?.teamId) {
      throw new BadRequestException(
        `Group ${group.id} has no valid group winner.`,
      );
    }

    if (!second?.teamId) {
      throw new BadRequestException(
        `Group ${group.id} has no valid runner-up.`,
      );
    }

    if (!third?.teamId) {
      throw new BadRequestException(
        `Group ${group.id} has no valid third-placed team.`,
      );
    }

    groupWinners.push(
      String(first.teamId),
    );

    groupRunnersUp.push(
      String(second.teamId),
    );

    thirdPlaced.push({
      groupId: String(group.id),

      teamId:
        String(third.teamId),

      points:
        Number(third.points ?? 0),

      goalDifference:
        Number(
          third.goalDifference ??
          third.goalDiff ??
          0,
        ),

      goalsScored:
        Number(
          third.goalsScored ??
          third.goalsFor ??
          0,
        ),
    });
  }

  // =======================================================
  // RANK THIRD-PLACED TEAMS
  //
  // 1. POINTS
  // 2. GOAL DIFFERENCE
  // 3. GOALS SCORED
  // =======================================================

  thirdPlaced.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (
      b.goalDifference !==
      a.goalDifference
    ) {
      return (
        b.goalDifference -
        a.goalDifference
      );
    }

    if (
      b.goalsScored !==
      a.goalsScored
    ) {
      return (
        b.goalsScored -
        a.goalsScored
      );
    }

    /*
     * Final deterministic fallback.
     *
     * This does NOT decide sporting merit.
     * It simply prevents unstable ordering when
     * all available statistics are identical.
     *
     * If your tournament has another official
     * tie-break rule, replace this with it.
     */
    return a.teamId.localeCompare(
      b.teamId,
    );
  });

  const bestThirdPlaced =
    thirdPlaced.slice(0, 2);

  // =======================================================
  // FINAL QUALIFIERS
  // =======================================================

  const qualifiers = [
    ...groupWinners,
    ...groupRunnersUp,
    ...bestThirdPlaced.map(
      (team) => team.teamId,
    ),
  ];

  if (qualifiers.length !== 8) {
    throw new BadRequestException(
      `Knockout generation expected 8 qualified teams but got ${qualifiers.length}.`,
    );
  }

  /*
   * Make absolutely sure every qualified team
   * is unique.
   */
  const uniqueQualifiers =
    new Set(qualifiers);

  if (
    uniqueQualifiers.size !==
    qualifiers.length
  ) {
    throw new BadRequestException(
      'Knockout qualification produced duplicate teams.',
    );
  }

  this.logger.log(
    `Generated ${qualifiers.length} knockout qualifiers for tournament ${tournamentId}`,
  );

  this.logger.log(
    JSON.stringify({
      groupWinners,
      groupRunnersUp,
      thirdPlaced,
      bestThirdPlaced,
      qualifiers,
    }),
  );

  // =======================================================
  // BUILD QUARTER-FINALS
  // =======================================================

  const matches: any[] = [];

  /*
   * We currently have:
   *
   * QF1: qualifier 1 vs qualifier 2
   * QF2: qualifier 3 vs qualifier 4
   * QF3: qualifier 5 vs qualifier 6
   * QF4: qualifier 7 vs qualifier 8
   *
   * Winners feed into:
   *
   * SF1
   * SF2
   *
   * Winners then feed into:
   *
   * FINAL
   */

  const quarterFinalStage =
    FixtureStage.QUARTER_FINAL;

  const semiFinalStage =
    FixtureStage.SEMI_FINAL;

  const finalStage =
    FixtureStage.FINAL;

  // =======================================================
  // QUARTER-FINALS
  // =======================================================

  for (
    let i = 0;
    i < 8;
    i += 2
  ) {
    const position =
      matches.filter(
        (match) =>
          match.stage ===
          quarterFinalStage,
      ).length + 1;

    const nextSemiPosition =
      position <= 2
        ? 1
        : 2;

    matches.push({
      stage:
        quarterFinalStage,

      position,

      homeSource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          qualifiers[i],
      },

      awaySource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          qualifiers[i + 1],
      },

      winnerFeedsToStage:
        semiFinalStage,

      winnerFeedsToPosition:
        nextSemiPosition,
    });
  }

  // =======================================================
  // SEMI-FINAL 1
  // =======================================================

  matches.push({
    stage:
      semiFinalStage,

    position: 1,

    homeSource: {
      type: 'match_winner',
      teamId: null,
    },

    awaySource: {
      type: 'match_winner',
      teamId: null,
    },

    winnerFeedsToStage:
      finalStage,

    winnerFeedsToPosition: 1,
  });

  // =======================================================
  // SEMI-FINAL 2
  // =======================================================

  matches.push({
    stage:
      semiFinalStage,

    position: 2,

    homeSource: {
      type: 'match_winner',
      teamId: null,
    },

    awaySource: {
      type: 'match_winner',
      teamId: null,
    },

    winnerFeedsToStage:
      finalStage,

    winnerFeedsToPosition: 1,
  });

  // =======================================================
  // FINAL
  // =======================================================

  matches.push({
    stage:
      finalStage,

    position: 1,

    homeSource: {
      type: 'match_winner',
      teamId: null,
    },

    awaySource: {
      type: 'match_winner',
      teamId: null,
    },
  });

  // =======================================================
  // CREATE BRACKET
  // =======================================================

  return this.createBracket(
    tournamentId,
    organizationId,
    {
      matches,
    },
  );
}
  // =========================================================
  // GENERATE SIX-TEAM BRACKET
  // =========================================================

  private async generateSixTeamBracket(
    tournamentId: string,
    organizationId: string,
    qualifiers: string[],
    firstStage: string,
  ) {
    if (
      qualifiers.length !== 6
    ) {
      throw new BadRequestException(
        'Six-team knockout generation requires exactly 6 qualifying teams.',
      );
    }

    /*
     * Prevent duplicate brackets.
     */
    const existing =
      await this.knockoutMatchRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      );

    if (existing.length) {
      throw new BadRequestException(
        'A knockout bracket already exists for this tournament.',
      );
    }

    /*
     * Current qualifier order is:
     *
     * Group A:
     *   qualifier 1
     *   qualifier 2
     *
     * Group B:
     *   qualifier 1
     *   qualifier 2
     *
     * Group C:
     *   qualifier 1
     *   qualifier 2
     *
     * We convert this into six seeds.
     *
     * This keeps the generation deterministic.
     */
    const seed1 =
      qualifiers[0];

    const seed2 =
      qualifiers[2];

    const seed3 =
      qualifiers[4];

    const seed4 =
      qualifiers[1];

    const seed5 =
      qualifiers[3];

    const seed6 =
      qualifiers[5];

    /*
     * IMPORTANT:
     *
     * Seed 1 and Seed 2 receive byes.
     *
     * Play-in matches:
     *
     * Match 1:
     *   Seed 3 vs Seed 6
     *
     * Match 2:
     *   Seed 4 vs Seed 5
     *
     * Semi 1:
     *   Seed 1 vs Winner Match 2
     *
     * Semi 2:
     *   Seed 2 vs Winner Match 1
     *
     * Final:
     *   Winner Semi 1 vs Winner Semi 2
     */

    const matches: any[] =
      [];

    /*
     * =======================================================
     * PLAY-IN MATCH 1
     * =======================================================
     */

    matches.push({
      stage:
        firstStage,

      position:
        1,

      homeSource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed3,
      },

      awaySource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed6,
      },

      winnerFeedsToStage:
        'semifinal',

      winnerFeedsToPosition:
        2,
    });

    /*
     * =======================================================
     * PLAY-IN MATCH 2
     * =======================================================
     */

    matches.push({
      stage:
        firstStage,

      position:
        2,

      homeSource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed4,
      },

      awaySource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed5,
      },

      winnerFeedsToStage:
        'semifinal',

      winnerFeedsToPosition:
        1,
    });

    /*
     * =======================================================
     * SEMI-FINAL 1
     * =======================================================
     *
     * Seed 1 receives a bye.
     *
     * The second slot waits for
     * Play-in Match 2 winner.
     */

    matches.push({
      stage:
        'semifinal',

      position:
        1,

      homeSource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed1,
      },

      awaySource: {
        type:
          'match_winner',

        teamId:
          null,
      },

      winnerFeedsToStage:
        'final',

      winnerFeedsToPosition:
        1,
    });

    /*
     * =======================================================
     * SEMI-FINAL 2
     * =======================================================
     *
     * Seed 2 receives a bye.
     *
     * The second slot waits for
     * Play-in Match 1 winner.
     */

    matches.push({
      stage:
        'semifinal',

      position:
        2,

      homeSource: {
        type:
          TeamSlotType.FIXED,

        teamId:
          seed2,
      },

      awaySource: {
        type:
          'match_winner',

        teamId:
          null,
      },

      winnerFeedsToStage:
        'final',

      winnerFeedsToPosition:
        1,
    });

    /*
     * =======================================================
     * FINAL
     * =======================================================
     */

    matches.push({
      stage:
        'final',

      position:
        1,

      homeSource: {
        type:
          'match_winner',

        teamId:
          null,
      },

      awaySource: {
        type:
          'match_winner',

        teamId:
          null,
      },
    });

    this.logger.log(
      `Generating six-team knockout bracket for tournament ${tournamentId}`,
    );

    this.logger.log(
      JSON.stringify(
        {
          seed1,
          seed2,
          seed3,
          seed4,
          seed5,
          seed6,
        },
        null,
        2,
      ),
    );

    return this.createBracket(
      tournamentId,
      organizationId,
      {
        matches,
      },
    );
  }

  // =========================================================
  // STAGE ORDER
  // =========================================================

  private getStageOrder(
    stage: string,
  ): number {
    const normalized =
      String(stage ?? '')
        .toLowerCase()
        .replace(
          /[-\s]/g,
          '_',
        );

    const order: Record<
      string,
      number
    > = {
      round_of_64: 1,

      round_of_32: 2,

      round_of_16: 3,

      round_of_8: 4,

      quarter_final: 4,

      quarter_finals: 4,

      semifinal: 5,

      semi_final: 5,

      semi_finals: 5,

      final: 6,
    };

    return (
      order[normalized] ??
      999
    );
  }
}