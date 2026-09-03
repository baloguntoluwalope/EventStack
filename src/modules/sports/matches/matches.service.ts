import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientSession } from 'mongoose';

import {
  IMatchRepository,
  MATCH_REPOSITORY,
} from './interfaces/match-repository.interface';

import {
  IKnockoutMatchRepository,
  KNOCKOUT_MATCH_REPOSITORY,
} from '../knockout/interfaces/knockout-repository.interface';

import { assertFound } from '../../../common/utils/assert-found.util';

import {
  MatchStatus,
  MatchResult,
  MatchPeriod,
} from './schemas/match.schema';

import {
  assertValidTransition,
  assertKnockoutResultIsDecisive,
} from './match-state-machine';

import { FixturesService } from '../fixtures/fixtures.service';

import { TeamSlotType } from '../fixtures/schemas/fixture.schema';

@Injectable()
export class MatchesService {
  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: IMatchRepository,

    @Inject(KNOCKOUT_MATCH_REPOSITORY)
    private readonly knockoutMatchRepo: IKnockoutMatchRepository,

    private readonly fixturesService: FixturesService,

    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================
  // FOOTBALL CLOCK
  // =========================================================

  private getPeriodBaseMinute(period: MatchPeriod): number {
    switch (period) {
      case MatchPeriod.FIRST_HALF:
        return 0;

      case MatchPeriod.HALF_TIME:
        return 45;

      case MatchPeriod.SECOND_HALF:
        return 45;

      case MatchPeriod.EXTRA_TIME:
      case MatchPeriod.EXTRA_TIME_FIRST_HALF:
        return 90;

      case MatchPeriod.EXTRA_TIME_HALF_TIME:
        return 105;

      case MatchPeriod.EXTRA_TIME_SECOND_HALF:
        return 105;

      case MatchPeriod.PENALTY_SHOOTOUT:
        return 120;

      case MatchPeriod.FULL_TIME:
        return 90;

      default:
        return 0;
    }
  }

  private getPeriodEndMinute(period: MatchPeriod): number {
    switch (period) {
      case MatchPeriod.FIRST_HALF:
        return 45;

      case MatchPeriod.SECOND_HALF:
        return 90;

      case MatchPeriod.EXTRA_TIME_FIRST_HALF:
        return 105;

      case MatchPeriod.EXTRA_TIME_SECOND_HALF:
        return 120;

      default:
        return 0;
    }
  }

  // =========================================================
  // START MATCH
  // =========================================================

  async start(
    fixtureId: string,
    organizationId: string,
  ) {
    const fixture =
      await this.fixturesService.findByIdOrThrow(
        fixtureId,
        organizationId,
      );

    const existing =
      await this.matchRepo.findByFixtureForTenant(
        fixtureId,
        organizationId,
      );

    if (existing) {
      throw new BadRequestException(
        'A match already exists for this fixture.',
      );
    }

    if (
      fixture.homeSlot.type !== TeamSlotType.FIXED ||
      fixture.awaySlot.type !== TeamSlotType.FIXED
    ) {
      throw new BadRequestException(
        'This fixture has unresolved team slots and cannot be started yet.',
      );
    }

    if (
      !fixture.homeSlot.teamId ||
      !fixture.awaySlot.teamId
    ) {
      throw new BadRequestException(
        'Both fixture teams must be resolved before starting the match.',
      );
    }

    const now = new Date();

    return this.matchRepo.create({
      fixtureId: fixture._id as any,
      tournamentId: fixture.tournamentId as any,
      organizationId: organizationId as any,

      homeTeamId: fixture.homeSlot.teamId as any,
      awayTeamId: fixture.awaySlot.teamId as any,

      status: MatchStatus.LIVE,

      startedAt: now,
      periodStartedAt: now,

      currentPeriod: MatchPeriod.FIRST_HALF,

      currentAddedTime: 0,

      homeScore: 0,
      awayScore: 0,

      period: 'first_half',
    });
  }

  // =========================================================
  // GET MATCH
  // =========================================================

  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    return assertFound(
      await this.matchRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Match not found',
    );
  }

  // =========================================================
  // PUBLIC GET
  // =========================================================

  async findByIdPublicOrThrow(id: string) {
    return assertFound(
      await this.matchRepo.findById(id),
      'Match not found',
    );
  }

  // =========================================================
  // GET MATCH FOR FIXTURE
  // =========================================================

  async findByFixtureIdOrNull(
    fixtureId: string,
    organizationId: string,
  ) {
    return this.matchRepo.findByFixtureForTenant(
      fixtureId,
      organizationId,
    );
  }

  // =========================================================
  // PUBLIC MATCH FOR FIXTURE
  // =========================================================

  async findByFixturePublicOrNull(
    fixtureId: string,
  ) {
    return this.matchRepo.findByFixturePublic(
      fixtureId,
    );
  }

  // =========================================================
  // LIST TOURNAMENT MATCHES
  // =========================================================

  listForTournament(
    tournamentId: string,
    organizationId: string,
  ) {
    return this.matchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );
  }


  // =========================================================
// PUBLIC TOURNAMENT MATCHES
// =========================================================

async listPublicForTournament(
  tournamentId: string,
) {
  return this.matchRepo.findByTournamentPublic(
    tournamentId,
  );
}

  // =========================================================
  // TRANSITION
  // =========================================================

  async transition(
    id: string,
    organizationId: string,
    targetStatus: MatchStatus,
  ) {
    const match =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    assertValidTransition(
      match.status,
      targetStatus,
    );

    // -------------------------------------------------------
    // FINISH VALIDATION
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.FINISHED) {
      const knockoutMatch =
        await this.knockoutMatchRepo.findByFixtureForTenant(
          match.fixtureId.toString(),
          organizationId,
        );

      assertKnockoutResultIsDecisive({
        isKnockout: !!knockoutMatch,

        fromStatus: match.status,

        homeScore: match.homeScore,
        awayScore: match.awayScore,

        hasPenaltyResult:
          !!match.penaltyResult,
      });
    }

    const update: Record<string, any> = {};
    const now = new Date();

    // -------------------------------------------------------
    // HALF TIME
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.HALFTIME) {
      update.status = MatchStatus.HALFTIME;
      update.period = 'halftime';

      update.currentPeriod =
        MatchPeriod.HALF_TIME;

      update.periodStartedAt = now;

      // Added time belongs only to first half.
      // Reset it before second half.
      update.currentAddedTime = 0;
    }

    // -------------------------------------------------------
    // SECOND HALF
    // -------------------------------------------------------

    if (
      targetStatus === MatchStatus.LIVE &&
      match.status === MatchStatus.HALFTIME
    ) {
      update.status = MatchStatus.LIVE;
      update.period = 'second_half';

      update.currentPeriod =
        MatchPeriod.SECOND_HALF;

      update.periodStartedAt = now;

      // Second half starts from 45:00.
      update.currentAddedTime = 0;
    }

    // -------------------------------------------------------
    // EXTRA TIME
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.EXTRA_TIME) {
      update.status = MatchStatus.EXTRA_TIME;
      update.period = 'extra_time';

      update.currentPeriod =
        MatchPeriod.EXTRA_TIME_FIRST_HALF;

      update.periodStartedAt = now;

      // Extra time starts from 90:00.
      update.currentAddedTime = 0;
    }

    // -------------------------------------------------------
    // PENALTY SHOOTOUT
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.PENALTIES) {
      update.status = MatchStatus.PENALTIES;
      update.period = 'penalties';

      update.currentPeriod =
        MatchPeriod.PENALTY_SHOOTOUT;

      update.periodStartedAt = now;

      update.currentAddedTime = 0;
    }

    // -------------------------------------------------------
    // FULL TIME
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.FINISHED) {
      update.status = MatchStatus.FINISHED;
      update.period = 'full_time';

      update.currentPeriod =
        MatchPeriod.FULL_TIME;

      update.endedAt = now;

      const effectiveHome =
        match.penaltyResult?.homeScore ??
        match.homeScore;

      const effectiveAway =
        match.penaltyResult?.awayScore ??
        match.awayScore;

      update.result =
        effectiveHome > effectiveAway
          ? MatchResult.HOME_WIN
          : effectiveHome < effectiveAway
            ? MatchResult.AWAY_WIN
            : MatchResult.DRAW;

      await this.fixturesService.markCompleted(
        match.fixtureId.toString(),
        organizationId,
      );
    }

    // -------------------------------------------------------
    // ABANDONED
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.ABANDONED) {
      update.status = MatchStatus.ABANDONED;
      update.endedAt = now;
    }

    const updated =
      await assertFound(
        await this.matchRepo.updateById(
          id,
          update,
        ),
        'Match not found',
      );

    // -------------------------------------------------------
    // MATCH FINISHED EVENT
    // -------------------------------------------------------

    if (targetStatus === MatchStatus.FINISHED) {
      this.eventEmitter.emit(
        'match.finished',
        {
          matchId: id,

          fixtureId:
            match.fixtureId.toString(),

          tournamentId:
            match.tournamentId.toString(),

          organizationId,

          homeTeamId:
            match.homeTeamId.toString(),

          awayTeamId:
            match.awayTeamId.toString(),

          result: update.result,
        },
      );
    }

    return updated;
  }

  // =========================================================
  // PENALTY RESULT
  // =========================================================

  async recomputePenaltyResult(
    id: string,
    homeScore: number,
    awayScore: number,
  ) {
    if (
      homeScore < 0 ||
      awayScore < 0 ||
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore)
    ) {
      throw new BadRequestException(
        'Penalty scores must be non-negative integers.',
      );
    }

    return this.matchRepo.updateById(
      id,
      {
        penaltyResult: {
          homeScore,
          awayScore,
        },
      },
    );
  }

  // =========================================================
  // PERIOD
  // =========================================================

  async applyPeriodEffect(
    id: string,
    organizationId: string,
    status: MatchStatus,
    period: MatchPeriod,
  ) {
    const match =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    if (match.status !== status) {
      assertValidTransition(
        match.status,
        status,
      );
    }

    const now = new Date();

    return this.matchRepo.updateById(
      id,
      {
        status,

        currentPeriod:
          period,

        periodStartedAt:
          now,

        // Every new period gets a fresh added-time counter.
        currentAddedTime: 0,
      },
    );
  }

  // =========================================================
  // ADDED TIME
  // =========================================================

  async setAddedTime(
    id: string,
    minutes: number,
  ) {
    if (
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > 30
    ) {
      throw new BadRequestException(
        'Added time must be an integer between 0 and 30 minutes.',
      );
    }

    const match =
      await this.matchRepo.findById(id);

    if (!match) {
      throw new BadRequestException(
        'Match not found.',
      );
    }

    return this.matchRepo.updateById(
      id,
      {
        currentAddedTime: minutes,
      },
    );
  }

  // =========================================================
  // SCORE
  // =========================================================

  async setScore(
    id: string,
    homeScore: number,
    awayScore: number,
    session?: ClientSession,
  ) {
    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      throw new BadRequestException(
        'Scores must be non-negative integers.',
      );
    }

    return this.matchRepo.updateById(
      id,
      {
        homeScore,
        awayScore,
      },
      session,
    );
  }

  // =========================================================
  // CLOCK INFORMATION
  // =========================================================

  async getClock(
    id: string,
    organizationId: string,
  ) {
    const match =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    const period =
      match.currentPeriod;

    const baseMinute =
      this.getPeriodBaseMinute(period);

    const normalEndMinute =
      this.getPeriodEndMinute(period);

    const addedTime =
      match.currentAddedTime ?? 0;

    return {
      matchId: id,

      status: match.status,

      period,

      periodStartedAt:
        match.periodStartedAt,

      baseMinute,

      normalEndMinute,

      addedTime,

      maxMinute:
        normalEndMinute + addedTime,
    };
  }
}