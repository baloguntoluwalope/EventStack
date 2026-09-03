import { MatchEventType } from './schemas/match-event.schema';
import {
  MatchStatus,
  MatchPeriod,
} from '../matches/schemas/match.schema';

/**
 * =========================================================
 * SCORING EVENTS
 * =========================================================
 *
 * Only these events affect the match score.
 *
 * GOAL
 * OWN_GOAL
 * PENALTY_SCORED
 *
 * Everything else is informational/stateful and must never
 * directly increase homeScore or awayScore.
 */
export const SCORING_EVENT_TYPES: MatchEventType[] = [
  MatchEventType.GOAL,
  MatchEventType.OWN_GOAL,
  MatchEventType.PENALTY_SCORED,
];

/**
 * =========================================================
 * PERIOD EFFECTS
 * =========================================================
 *
 * These are the state transitions caused by period events.
 *
 * The match clock is based on the period, not on resetting
 * the entire clock to zero.
 *
 * FIRST HALF
 *   0 → 45+
 *
 * SECOND HALF
 *   45 → 90+
 *
 * EXTRA TIME FIRST HALF
 *   90 → 105+
 *
 * EXTRA TIME SECOND HALF
 *   105 → 120+
 */
export const PERIOD_EFFECTS: Partial<
  Record<
    MatchEventType,
    {
      status: MatchStatus;
      period: MatchPeriod;
    }
  >
> = {
  /**
   * -------------------------------------------------------
   * NORMAL MATCH
   * -------------------------------------------------------
   */

  [MatchEventType.MATCH_STARTED]: {
    status: MatchStatus.LIVE,
    period: MatchPeriod.FIRST_HALF,
  },

  [MatchEventType.HALF_TIME]: {
    status: MatchStatus.HALFTIME,
    period: MatchPeriod.HALF_TIME,
  },

  [MatchEventType.SECOND_HALF_STARTED]: {
    status: MatchStatus.LIVE,
    period: MatchPeriod.SECOND_HALF,
  },

  [MatchEventType.FULL_TIME]: {
    status: MatchStatus.FINISHED,
    period: MatchPeriod.FULL_TIME,
  },

  /**
   * -------------------------------------------------------
   * EXTRA TIME
   * -------------------------------------------------------
   *
   * Extra time does NOT restart from zero.
   *
   * First ET half:
   *   90 → 105+
   *
   * Second ET half:
   *   105 → 120+
   */

  [MatchEventType.EXTRA_TIME_START]: {
    status: MatchStatus.EXTRA_TIME,
    period: MatchPeriod.EXTRA_TIME_FIRST_HALF,
  },

  [MatchEventType.EXTRA_TIME_HALF_TIME]: {
    status: MatchStatus.EXTRA_TIME,
    period: MatchPeriod.EXTRA_TIME_HALF_TIME,
  },

  [MatchEventType.EXTRA_TIME_SECOND_HALF_STARTED]: {
    status: MatchStatus.EXTRA_TIME,
    period: MatchPeriod.EXTRA_TIME_SECOND_HALF,
  },

  [MatchEventType.EXTRA_TIME_END]: {
    status: MatchStatus.FINISHED,
    period: MatchPeriod.FULL_TIME,
  },

  /**
   * -------------------------------------------------------
   * PENALTY SHOOTOUT
   * -------------------------------------------------------
   */

  [MatchEventType.PENALTY_SHOOTOUT_START]: {
    status: MatchStatus.PENALTIES,
    period: MatchPeriod.PENALTY_SHOOTOUT,
  },

  [MatchEventType.PENALTY_SHOOTOUT_END]: {
    status: MatchStatus.FINISHED,
    period: MatchPeriod.FULL_TIME,
  },

  /**
   * -------------------------------------------------------
   * ABANDONED
   * -------------------------------------------------------
   */

  [MatchEventType.MATCH_ABANDONED]: {
    status: MatchStatus.ABANDONED,
    period: MatchPeriod.FULL_TIME,
  },
};

/**
 * =========================================================
 * PERIOD EVENT PRECONDITIONS
 * =========================================================
 *
 * These rules prevent invalid transitions.
 *
 * Example:
 *
 * SECOND_HALF_STARTED cannot happen while the match is LIVE.
 *
 * It must first go:
 *
 * LIVE
 *   ↓
 * HALF_TIME
 *   ↓
 * HALFTIME
 *   ↓
 * SECOND_HALF_STARTED
 */
export const PERIOD_EVENT_PRECONDITIONS: Partial<
  Record<MatchEventType, MatchStatus[]>
> = {
  /**
   * -------------------------------------------------------
   * NORMAL MATCH
   * -------------------------------------------------------
   */

  [MatchEventType.MATCH_STARTED]: [
    MatchStatus.SCHEDULED,
  ],

  [MatchEventType.HALF_TIME]: [
    MatchStatus.LIVE,
  ],

  [MatchEventType.SECOND_HALF_STARTED]: [
    MatchStatus.HALFTIME,
  ],

  /**
   * -------------------------------------------------------
   * NORMAL FULL TIME
   * -------------------------------------------------------
   *
   * A normal match can finish from LIVE.
   */
  [MatchEventType.FULL_TIME]: [
    MatchStatus.LIVE,
  ],

  /**
   * -------------------------------------------------------
   * EXTRA TIME
   * -------------------------------------------------------
   *
   * Extra time begins after the normal 90 minutes.
   *
   * The match must currently be LIVE.
   */
  [MatchEventType.EXTRA_TIME_START]: [
    MatchStatus.LIVE,
  ],

  /**
   * ET first half:
   *
   * EXTRA_TIME_FIRST_HALF
   *          ↓
   * EXTRA_TIME_HALF_TIME
   */
  [MatchEventType.EXTRA_TIME_HALF_TIME]: [
    MatchStatus.EXTRA_TIME,
  ],

  /**
   * ET second half starts only after ET half time.
   */
  [MatchEventType.EXTRA_TIME_SECOND_HALF_STARTED]: [
    MatchStatus.EXTRA_TIME,
  ],

  /**
   * ET can finish while still in EXTRA_TIME.
   */
  [MatchEventType.EXTRA_TIME_END]: [
    MatchStatus.EXTRA_TIME,
  ],

  /**
   * -------------------------------------------------------
   * PENALTY SHOOTOUT
   * -------------------------------------------------------
   *
   * Shootout starts after extra time.
   */
  [MatchEventType.PENALTY_SHOOTOUT_START]: [
    MatchStatus.FINISHED,
  ],

  /**
   * Shootout ends while the match is in PENALTIES.
   */
  [MatchEventType.PENALTY_SHOOTOUT_END]: [
    MatchStatus.PENALTIES,
  ],

  /**
   * -------------------------------------------------------
   * ABANDONED
   * -------------------------------------------------------
   *
   * A match may be abandoned while active.
   */
  [MatchEventType.MATCH_ABANDONED]: [
    MatchStatus.LIVE,
    MatchStatus.HALFTIME,
    MatchStatus.EXTRA_TIME,
    MatchStatus.PENALTIES,
  ],
};

/**
 * =========================================================
 * CLOCK BASE MINUTES
 * =========================================================
 *
 * This is the foundation for the football clock.
 *
 * IMPORTANT:
 *
 * The frontend must NOT simply reset the timer to zero when
 * the period changes.
 *
 * The football clock uses these base minutes:
 *
 * FIRST_HALF               0
 * SECOND_HALF             45
 * EXTRA_TIME_FIRST_HALF   90
 * EXTRA_TIME_SECOND_HALF 105
 *
 * Therefore:
 *
 * First half:
 *   0 → 45+
 *
 * Second half:
 *   45 → 90+
 *
 * Extra time first half:
 *   90 → 105+
 *
 * Extra time second half:
 *   105 → 120+
 */
export const PERIOD_BASE_MINUTES: Record<
  MatchPeriod,
  number
> = {
  [MatchPeriod.PRE_MATCH]: 0,

  [MatchPeriod.FIRST_HALF]: 0,

  [MatchPeriod.HALF_TIME]: 45,

  [MatchPeriod.SECOND_HALF]: 45,

  [MatchPeriod.FULL_TIME]: 90,

  [MatchPeriod.EXTRA_TIME]: 90, // <--- Add this if EXTRA_TIME exists in your MatchPeriod enum

  [MatchPeriod.EXTRA_TIME_FIRST_HALF]: 90,

  [MatchPeriod.EXTRA_TIME_HALF_TIME]: 105,

  [MatchPeriod.EXTRA_TIME_SECOND_HALF]: 105,

  [MatchPeriod.PENALTY_SHOOTOUT]: 120,
};