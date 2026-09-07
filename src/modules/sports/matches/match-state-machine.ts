import { BadRequestException } from '@nestjs/common';
import { MatchStatus } from './schemas/match.schema';

const TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  [MatchStatus.SCHEDULED]: [
    MatchStatus.LIVE,
  ],

  [MatchStatus.LIVE]: [
    MatchStatus.HALFTIME,
    MatchStatus.EXTRA_TIME,
    MatchStatus.FINISHED,
    MatchStatus.ABANDONED,
    MatchStatus.PAUSED,
  ],

  [MatchStatus.HALFTIME]: [
    MatchStatus.LIVE,
  ],

  [MatchStatus.EXTRA_TIME]: [
    MatchStatus.PENALTIES,
    MatchStatus.FINISHED,
    MatchStatus.ABANDONED,
    MatchStatus.PAUSED,
  ],

  [MatchStatus.PENALTIES]: [
    MatchStatus.FINISHED,
    MatchStatus.PAUSED,
  ],

  /**
   * PAUSED is a temporary state.
   *
   * Resume returns the match to the state it was in
   * immediately before it was paused.
   *
   * The actual previous status is handled by MatchesService.
   */
  [MatchStatus.PAUSED]: [
    MatchStatus.LIVE,
    MatchStatus.EXTRA_TIME,
    MatchStatus.PENALTIES,
    MatchStatus.ABANDONED,
  ],

  [MatchStatus.FINISHED]: [],

  [MatchStatus.ABANDONED]: [],
};

export function assertValidTransition(
  current: MatchStatus,
  next: MatchStatus,
) {
  if (!TRANSITIONS[current]?.includes(next)) {
    throw new BadRequestException(
      `Cannot transition match from "${current}" to "${next}"`,
    );
  }
}

/**
 * Real, backend-enforced fix for the knockout-draw-stalls-the-bracket
 * gap.
 *
 * A knockout match cannot reach FINISHED while the regulation/extra-time
 * score is level unless it has gone through penalties or already has
 * a penalty result.
 *
 * League/group matches are exempt because a draw is a valid result.
 */
export function assertKnockoutResultIsDecisive(params: {
  isKnockout: boolean;
  fromStatus: MatchStatus;
  homeScore: number;
  awayScore: number;
  hasPenaltyResult: boolean;
}) {
  if (!params.isKnockout) return;

  const isDrawn =
    params.homeScore === params.awayScore;

  if (
    isDrawn &&
    params.fromStatus !== MatchStatus.PENALTIES &&
    !params.hasPenaltyResult
  ) {
    throw new BadRequestException(
      'Knockout match is level — it cannot be finished from this state. Proceed through EXTRA_TIME and PENALTIES to produce a decisive result.',
    );
  }
}