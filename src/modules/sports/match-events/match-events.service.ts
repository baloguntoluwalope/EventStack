import {  BadRequestException,  ConflictException,  ForbiddenException,  Inject,  Injectable,} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {  ClientSession,  Types,} from 'mongoose';
import {  IMatchEventRepository,  MATCH_EVENT_REPOSITORY,} from './interfaces/match-event-repository.interface';
import { assertFound } from '../../../common/utils/assert-found.util';
import {  MatchEventType,  MatchEventStatus,} from './schemas/match-event.schema';
import { CreateMatchEventDto } from './dto/create-match-event.dto';
import { MatchesService } from '../matches/matches.service';
import { MatchStatus } from '../matches/schemas/match.schema';
import { PlayersService } from '../players/players.service';
import {  SCORING_EVENT_TYPES,  PERIOD_EFFECTS,  PERIOD_EVENT_PRECONDITIONS,} from './match-event-effects';

const TEAM_REQUIRED_TYPES: MatchEventType[] = [
  // Scoring
  MatchEventType.GOAL,
  MatchEventType.OWN_GOAL,
  MatchEventType.DISALLOWED_GOAL,

  // Match actions
  MatchEventType.OFFSIDE,
  MatchEventType.FOUL,
  MatchEventType.FREE_KICK,
  MatchEventType.CORNER,
  MatchEventType.GOAL_KICK,
  MatchEventType.THROW_IN,

  // Cards
  MatchEventType.YELLOW_CARD,
  MatchEventType.SECOND_YELLOW,
  MatchEventType.RED_CARD,

  // Players
  MatchEventType.SUBSTITUTION,
  MatchEventType.INJURY,

  // Penalties
  MatchEventType.PENALTY_AWARDED,
  MatchEventType.PENALTY_SCORED,
  MatchEventType.PENALTY_MISSED,
  MatchEventType.PENALTY_SAVED,

  // Shootout
  MatchEventType.PENALTY_SHOOTOUT_KICK,
];

const ACTIVE_PLAY_STATES: MatchStatus[] = [
  MatchStatus.LIVE,
  MatchStatus.EXTRA_TIME,
  MatchStatus.PENALTIES,
];

const MONGO_DUPLICATE_KEY_CODE = 11000;

/**
 * Events that count as a normal player goal.
 *
 * OWN_GOAL is intentionally excluded because the player
 * who caused the own goal should not receive a normal goal.
 */
const PLAYER_GOAL_EVENT_TYPES: MatchEventType[] = [
  MatchEventType.GOAL,
  MatchEventType.PENALTY_SCORED,
];

/**
 * Events that should count as an assist.
 *
 * For now only normal GOAL events generate assists.
 *
 * We intentionally do not count:
 * - own goals
 * - penalty goals
 * - shootout kicks
 */
const ASSIST_EVENT_TYPES: MatchEventType[] = [
  MatchEventType.GOAL,
];

@Injectable()
export class MatchEventsService {
  constructor(
    @Inject(MATCH_EVENT_REPOSITORY)
    private readonly eventRepo: IMatchEventRepository,
    private readonly matchesService: MatchesService,
    private readonly playersService: PlayersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================
  // CREATE EVENT
  // =========================================================
  async create(
    matchId: string,
    organizationId: string,
    userId: string,
    dto: CreateMatchEventDto,
  ) {
    this.assertObjectId(
      matchId,
      'matchId',
    );
    this.assertObjectId(
      organizationId,
      'organizationId',
    );
    this.assertObjectId(
      userId,
      'userId',
    );

    // -------------------------------------------------------
    // IDEMPOTENCY
    // -------------------------------------------------------
    if (dto.idempotencyKey) {
      const existing =
        await this.eventRepo.findByIdempotencyKey(
          matchId,
          dto.idempotencyKey,
        );
      if (existing) {
        return existing;
      }
    }

    // -------------------------------------------------------
    // MATCH
    // -------------------------------------------------------
    const match =
      await this.matchesService.findByIdOrThrow(
        matchId,
        organizationId,
      );

    // -------------------------------------------------------
    // CORRECTION
    // -------------------------------------------------------
    const isCorrection =
      Boolean(dto.correctsEventId);
    let originalEvent:
      | Awaited<
          ReturnType<
            IMatchEventRepository['findByIdForTenant']
          >
        >
      | null = null;

    if (isCorrection) {
      this.assertObjectId(
        dto.correctsEventId!,
        'correctsEventId',
      );
      originalEvent =
        await assertFound(
          await this.eventRepo.findByIdForTenant(
            dto.correctsEventId!,
            organizationId,
          ),
          'Original event to correct not found',
        );

      if (
        String(
          originalEvent.matchId,
        ) !== String(matchId)
      ) {
        throw new BadRequestException(
          'Correction must target an event on the same match.',
        );
      }

      if (
        originalEvent.status ===
        MatchEventStatus.VOIDED
      ) {
        throw new BadRequestException(
          'This event has already been voided.',
        );
      }
    }

    // -------------------------------------------------------
    // EVENT CLASSIFICATION
    // -------------------------------------------------------
    const isScoringEvent =
      SCORING_EVENT_TYPES.includes(
        dto.type,
      );
    const originalWasScoring =
      Boolean(
        originalEvent &&
          SCORING_EVENT_TYPES.includes(
            originalEvent.type,
          ),
      );

    /*
     * A correction of a scoring event must
     * recalculate the current score.
     */
    const mustRecalculateScore =
      isScoringEvent ||
      originalWasScoring;

    // -------------------------------------------------------
    // PERIOD VALIDATION
    // -------------------------------------------------------
    const preconditions =
      PERIOD_EVENT_PRECONDITIONS[
        dto.type
      ];
    if (
      preconditions &&
      !preconditions.includes(
        match.status,
      )
    ) {
      throw new BadRequestException(
        `"${dto.type}" requires match status to be one of [${preconditions.join(
          ', ',
        )}], currently "${match.status}"`,
      );
    }

    // -------------------------------------------------------
    // SCORING STATE VALIDATION
    // -------------------------------------------------------
    if (
      !isCorrection &&
      isScoringEvent &&
      !ACTIVE_PLAY_STATES.includes(
        match.status,
      )
    ) {
      throw new BadRequestException(
        `Cannot record a ${dto.type} while match status is "${match.status}".`,
      );
    }

    // -------------------------------------------------------
    // TEAM / PLAYER VALIDATION
    // -------------------------------------------------------
    await this.validateParticipants(
      match,
      organizationId,
      dto,
    );

    // -------------------------------------------------------
    // CORRECTION VALIDATION
    // -------------------------------------------------------
    if (
      originalEvent &&
      isCorrection
    ) {
      this.validateCorrection(
        originalEvent,
        dto,
      );
    }

    // =======================================================
    // WRITE TRANSACTION
    // =======================================================
    try {
      const created =
        await this.eventRepo.withTransaction(
          async (
            session: ClientSession,
          ) => {
            // -----------------------------------------------
            // VOID ORIGINAL
            // -----------------------------------------------
            if (originalEvent) {
              await this.eventRepo.updateById(
                originalEvent._id.toString(),
                {
                  status:
                    MatchEventStatus.VOIDED,
                },
                session,
              );
            }

            // -----------------------------------------------
            // CREATE EVENT
            // -----------------------------------------------
            return this.eventRepo.create(
              {
                type: dto.type,
                teamId:
                  dto.teamId
                    ? new Types.ObjectId(
                        dto.teamId,
                      )
                    : null,
                playerId:
                  dto.playerId
                    ? new Types.ObjectId(
                        dto.playerId,
                      )
                    : null,
                /*
                 * secondaryPlayerId is used as the
                 * assisting player for GOAL events.
                 */
                secondaryPlayerId:
                  dto.secondaryPlayerId
                    ? new Types.ObjectId(
                        dto.secondaryPlayerId,
                      )
                    : null,
                minute:
                  dto.minute,
                addedMinute:
                  dto.addedMinute,
                metadata:
                  dto.metadata ?? {},
                status:
                  MatchEventStatus.ACTIVE,
                idempotencyKey:
                  dto.idempotencyKey ??
                  null,
                correctsEventId:
                  dto.correctsEventId
                    ? new Types.ObjectId(
                        dto.correctsEventId,
                      )
                    : null,
                matchId:
                  new Types.ObjectId(
                    matchId,
                  ),
                tournamentId:
                  match.tournamentId,
                organizationId:
                  new Types.ObjectId(
                    organizationId,
                  ),
                createdBy:
                  new Types.ObjectId(
                    userId,
                  ),
              },
              session,
            );
          },
        );

      // =====================================================
      // SCORE
      // =====================================================
      if (
        mustRecalculateScore
      ) {
        await this.recalculateAndPersistScore(
          matchId,
          organizationId,
          match.homeTeamId.toString(),
          match.awayTeamId.toString(),
        );
      }

      // =====================================================
      // PERIOD EFFECTS
      // =====================================================
      const periodEffect =
        PERIOD_EFFECTS[dto.type];
      if (periodEffect) {
        await this.matchesService.applyPeriodEffect(
          matchId,
          organizationId,
          periodEffect.status,
          periodEffect.period,
        );
      }

      // =====================================================
      // ADDED TIME
      // =====================================================
   if (dto.type === MatchEventType.ADDED_TIME_ANNOUNCED) {
  const addedMinutes = dto.metadata?.addedMinutes;

  if (
    !Number.isInteger(Number(addedMinutes)) ||
    Number(addedMinutes) < 0 ||
    Number(addedMinutes) > 30
  ) {
    throw new BadRequestException(
      'addedMinutes must be an integer between 0 and 30.',
    );
  }
}

      // =====================================================
      // PENALTY SHOOTOUT
      // =====================================================
      if (
        dto.type ===
        MatchEventType.PENALTY_SHOOTOUT_KICK
      ) {
        await this.recomputePenaltyResult(
          matchId,
          organizationId,
          match.homeTeamId.toString(),
          match.awayTeamId.toString(),
        );
      }

      // =====================================================
      // REALTIME EVENT
      // =====================================================
      if (
        mustRecalculateScore ||
        periodEffect ||
        dto.type ===
          MatchEventType.PENALTY_SHOOTOUT_KICK
      ) {
        const freshMatch =
          await this.matchesService.findByIdOrThrow(
            matchId,
            organizationId,
          );
        this.eventEmitter.emit(
          'match.event.created',
          {
            matchId,
            type:
              dto.type.toUpperCase(),
            payload: {
              homeScore:
                freshMatch.homeScore,
              awayScore:
                freshMatch.awayScore,
              penaltyResult:
                freshMatch.penaltyResult,
              status:
                freshMatch.status,
              period:
                freshMatch.currentPeriod,
              minute:
                dto.minute,
              addedMinute:
                dto.addedMinute,
              teamId:
                dto.teamId,
              playerId:
                dto.playerId,
              secondaryPlayerId:
                dto.secondaryPlayerId,
              correctsEventId:
                dto.correctsEventId ??
                null,
              /*
               * Useful for the live frontend.
               */
              isGoal:
                PLAYER_GOAL_EVENT_TYPES.includes(
                  dto.type,
                ),
              hasAssist:
                dto.type ===
                  MatchEventType.GOAL &&
                Boolean(
                  dto.secondaryPlayerId,
                ),
            },
          },
        );
      }

      return created;
    } catch (error: any) {
      // -----------------------------------------------------
      // IDEMPOTENCY RACE
      // -----------------------------------------------------
      if (
        error?.code ===
          MONGO_DUPLICATE_KEY_CODE &&
        dto.idempotencyKey
      ) {
        const winner =
          await this.eventRepo.findByIdempotencyKey(
            matchId,
            dto.idempotencyKey,
          );
        if (winner) {
          return winner;
        }
        throw new ConflictException(
          'Duplicate event submission could not be resolved.',
        );
      }
      throw error;
    }
  }

  // =========================================================
  // PARTICIPANT VALIDATION
  // =========================================================
  private async validateParticipants(
    match: any,
    organizationId: string,
    dto: CreateMatchEventDto,
  ) {
    const requiresTeam =
      TEAM_REQUIRED_TYPES.includes(
        dto.type,
      );
    if (
      requiresTeam &&
      !dto.teamId
    ) {
      throw new BadRequestException(
        `teamId is required for event type "${dto.type}".`,
      );
    }

    if (
      requiresTeam &&
      dto.teamId
    ) {
      const validTeamIds = [
        String(match.homeTeamId),
        String(match.awayTeamId),
      ];
      if (
        !validTeamIds.includes(
          String(dto.teamId),
        )
      ) {
        throw new ForbiddenException(
          'Team is not part of this match.',
        );
      }
    }

    if (
      dto.playerId &&
      dto.teamId
    ) {
      await this.assertPlayerOnTeam(
        dto.playerId,
        dto.teamId,
        organizationId,
      );
    }

    /*
     * For GOAL events, secondaryPlayerId is the assister.
     *
     * The assister must belong to the same team
     * as the goal scorer.
     */
    if (
      dto.type ===
        MatchEventType.GOAL &&
      dto.secondaryPlayerId
    ) {
      if (!dto.teamId) {
        throw new BadRequestException(
          'teamId is required when an assist is recorded.',
        );
      }

      if (
        dto.playerId &&
        String(dto.playerId) ===
          String(dto.secondaryPlayerId)
      ) {
        throw new BadRequestException(
          'A player cannot assist their own goal.',
        );
      }

      await this.assertPlayerOnTeam(
        dto.secondaryPlayerId,
        dto.teamId,
        organizationId,
      );
    }

    // -------------------------------------------------------
    // SUBSTITUTION
    // -------------------------------------------------------
    if (
      dto.type ===
      MatchEventType.SUBSTITUTION
    ) {
      if (!dto.teamId) {
        throw new BadRequestException(
          'teamId is required for a substitution.',
        );
      }

      if (!dto.playerId) {
        throw new BadRequestException(
          'playerId is required for a substitution.',
        );
      }

      if (
        !dto.secondaryPlayerId
      ) {
        throw new BadRequestException(
          'secondaryPlayerId is required for a substitution.',
        );
      }

      if (
        String(dto.playerId) ===
        String(dto.secondaryPlayerId)
      ) {
        throw new BadRequestException(
          'A substitution must use two different players.',
        );
      }

      await this.assertPlayerOnTeam(
        dto.secondaryPlayerId,
        dto.teamId,
        organizationId,
      );
    }
  }

  // =========================================================
  // CORRECTION VALIDATION
  // =========================================================
  private validateCorrection(
    originalEvent: any,
    dto: CreateMatchEventDto,
  ) {
    if (
      TEAM_REQUIRED_TYPES.includes(
        dto.type,
      )
    ) {
      if (!dto.teamId) {
        throw new BadRequestException(
          `teamId is required for correction type "${dto.type}".`,
        );
      }

      if (
        originalEvent.teamId &&
        String(
          originalEvent.teamId,
        ) !==
          String(dto.teamId)
      ) {
        throw new BadRequestException(
          'Correction team must match the original event team.',
        );
      }
    }

    if (
      originalEvent.playerId &&
      dto.playerId &&
      String(
        originalEvent.playerId,
      ) !==
        String(dto.playerId)
    ) {
      throw new BadRequestException(
        'Correction player must match the original event player.',
      );
    }

    /*
     * If correcting a GOAL, the assister should also
     * remain the same when one existed originally.
     */
    if (
      originalEvent.type ===
        MatchEventType.GOAL &&
      originalEvent.secondaryPlayerId &&
      dto.secondaryPlayerId &&
      String(
        originalEvent.secondaryPlayerId,
      ) !==
        String(dto.secondaryPlayerId)
    ) {
      throw new BadRequestException(
        'Correction assister must match the original event assister.',
      );
    }
  }

  // =========================================================
  // PLAYER VALIDATION
  // =========================================================
  private async assertPlayerOnTeam(
    playerId: string,
    teamId: string,
    organizationId: string,
  ) {
    const roster =
      await this.playersService.listForTeam(
        teamId,
        organizationId,
      );
    const exists =
      roster.some(
        (player) =>
          String(player.id) ===
          String(playerId),
      );

    if (!exists) {
      throw new BadRequestException(
        `Player ${playerId} is not on the roster of team ${teamId}.`,
      );
    }
  }

  // =========================================================
  // RECALCULATE + PERSIST SCORE
  // =========================================================
  private async recalculateAndPersistScore(
    matchId: string,
    organizationId: string,
    homeTeamId: string,
    awayTeamId: string,
  ) {
    const activeGoals =
      await this.eventRepo.findActiveGoalsForMatch(
        matchId,
      );

    let homeScore = 0;
    let awayScore = 0;

    for (
      const event of activeGoals
    ) {
      if (!event.teamId) {
        continue;
      }

      const eventTeamId =
        event.teamId.toString();
      let scoringTeam =
        eventTeamId;

      if (
        event.type ===
        MatchEventType.OWN_GOAL
      ) {
        if (
          eventTeamId ===
          homeTeamId
        ) {
          scoringTeam =
            awayTeamId;
        } else if (
          eventTeamId ===
          awayTeamId
        ) {
          scoringTeam =
            homeTeamId;
        }
      }

      if (
        scoringTeam ===
        homeTeamId
      ) {
        homeScore += 1;
      }

      if (
        scoringTeam ===
        awayTeamId
      ) {
        awayScore += 1;
      }
    }

    console.log(
      '[MatchEventsService] Recalculated score:',
      {
        matchId,
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        activeGoalCount:
          activeGoals.length,
      },
    );

    await this.matchesService.setScore(
      matchId,
      homeScore,
      awayScore,
    );
  }

  // =========================================================
  // PLAYER STATISTICS
  // =========================================================
  /**
   * Calculates simple player statistics directly from
   * ACTIVE match events.
   *
   * This means corrections automatically work because
   * VOIDED events are ignored.
   *
   * Current statistics:
   *
   * goals
   * assists
   * ownGoals
   * yellowCards
   * redCards
   * appearances
   */
  async getPlayerStatistics(
    matchId: string,
    organizationId: string,
  ) {
    await this.matchesService.findByIdOrThrow(
      matchId,
      organizationId,
    );

    const events =
      await this.eventRepo.findByMatchForTenant(
        matchId,
        organizationId,
      );

    const statistics = new Map<
      string,
      {
        playerId: string;
        goals: number;
        assists: number;
        ownGoals: number;
        yellowCards: number;
        redCards: number;
        appearances: number;
      }
    >();

    const getStats = (
      playerId: string,
    ) => {
      if (!statistics.has(playerId)) {
        statistics.set(
          playerId,
          {
            playerId,
            goals: 0,
            assists: 0,
            ownGoals: 0,
            yellowCards: 0,
            redCards: 0,
            appearances: 0,
          },
        );
      }
      return statistics.get(
        playerId,
      )!;
    };

    for (const event of events) {
      if (
        event.status !==
        MatchEventStatus.ACTIVE
      ) {
        continue;
      }

      // -----------------------------------------------------
      // GOALS
      // -----------------------------------------------------
      if (
        event.playerId &&
        PLAYER_GOAL_EVENT_TYPES.includes(
          event.type,
        )
      ) {
        const stats =
          getStats(
            event.playerId.toString(),
          );
        stats.goals += 1;
      }

      // -----------------------------------------------------
      // OWN GOALS
      // -----------------------------------------------------
      if (
        event.playerId &&
        event.type ===
          MatchEventType.OWN_GOAL
      ) {
        const stats =
          getStats(
            event.playerId.toString(),
          );
        stats.ownGoals += 1;
      }

      // -----------------------------------------------------
      // ASSISTS
      // -----------------------------------------------------
      if (
        event.secondaryPlayerId &&
        ASSIST_EVENT_TYPES.includes(
          event.type,
        )
      ) {
        const stats =
          getStats(
            event.secondaryPlayerId.toString(),
          );
        stats.assists += 1;
      }

      // -----------------------------------------------------
      // YELLOW CARD
      // -----------------------------------------------------
      if (
        event.playerId &&
        (
          event.type ===
            MatchEventType.YELLOW_CARD ||
          event.type ===
            MatchEventType.SECOND_YELLOW
        )
      ) {
        const stats =
          getStats(
            event.playerId.toString(),
          );
        stats.yellowCards += 1;
      }

      // -----------------------------------------------------
      // RED CARD
      // -----------------------------------------------------
      if (
        event.playerId &&
        event.type ===
          MatchEventType.RED_CARD
      ) {
        const stats =
          getStats(
            event.playerId.toString(),
          );
        stats.redCards += 1;
      }
    }

    return Array.from(
      statistics.values(),
    );
  }

  // =========================================================
  // PENALTY SHOOTOUT
  // =========================================================
  private async recomputePenaltyResult(
    matchId: string,
    organizationId: string,
    homeTeamId: string,
    awayTeamId: string,
  ) {
    const events =
      await this.eventRepo.findByMatchForTenant(
        matchId,
        organizationId,
      );

    const kicks =
      events.filter(
        (event) =>
          event.type ===
            MatchEventType.PENALTY_SHOOTOUT_KICK &&
          event.status ===
            MatchEventStatus.ACTIVE,
      );

    let homeScore = 0;
    let awayScore = 0;

    for (
      const kick of kicks
    ) {
      if (
        kick.metadata?.scored !==
        true
      ) {
        continue;
      }

      const teamId =
        kick.teamId?.toString();
      if (
        teamId ===
        homeTeamId
      ) {
        homeScore += 1;
      } else if (
        teamId ===
        awayTeamId
      ) {
        awayScore += 1;
      }
    }

    await this.matchesService.recomputePenaltyResult(
      matchId,
      homeScore,
      awayScore,
    );
  }

  // =========================================================
  // LIST EVENTS
  // =========================================================
  async listForMatch(
    matchId: string,
    organizationId: string,
  ) {
    await this.matchesService.findByIdOrThrow(
      matchId,
      organizationId,
    );

    return this.eventRepo.findByMatchForTenant(
      matchId,
      organizationId,
    );
  }

  // =========================================================
  // OBJECT ID VALIDATION
  // =========================================================
  private assertObjectId(
    value: string,
    fieldName: string,
  ) {
    if (
      !Types.ObjectId.isValid(
        value,
      )
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid MongoDB ObjectId.`,
      );
    }
 
 }

 // =========================================================
// LIST EVENTS — PUBLIC
// =========================================================

async listForMatchPublic(
  matchId: string,
) {
  this.assertObjectId(
    matchId,
    'matchId',
  );

  await this.matchesService.findByIdPublicOrThrow(
    matchId,
  );

  return this.eventRepo.findByMatchPublic(
    matchId,
  );
}

}