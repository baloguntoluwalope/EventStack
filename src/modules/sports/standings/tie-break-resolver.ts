// src/modules/sports/standings/tie-break-resolver.ts
import { Logger } from '@nestjs/common';

export interface BaseStandingRow {
  teamId: string;
  points: number;
  goalDifference: number;
  goalsFor: number;
  headToHeadPoints?: number;
  fairPlayPoints?: number;
}

const COMPARATORS: Record<string, (a: BaseStandingRow, b: BaseStandingRow) => number> = {
  points: (a, b) => b.points - a.points,
  goalDifference: (a, b) => b.goalDifference - a.goalDifference,
  goalsFor: (a, b) => b.goalsFor - a.goalsFor,
};

const logger = new Logger('TieBreakResolver');

/**
 * Applies tie-break rules in configured order using generics so full 
 * StandingRow objects retain their shape without type mismatches.
 */
export function resolveStandings<T extends BaseStandingRow>(rows: T[], tieBreakRules: string[]): T[] {
  const supportedRules = tieBreakRules.filter((rule) => {
    if (!COMPARATORS[rule]) {
      logger.warn(
        `Tournament tie-break rule "${rule}" is not implemented and will be ignored. Supported: ${Object.keys(COMPARATORS).join(', ')}`,
      );
      return false;
    }
    return true;
  });

  return [...rows].sort((a, b) => {
    for (const rule of supportedRules) {
      const result = COMPARATORS[rule](a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

export const SUPPORTED_TIE_BREAK_RULES = Object.keys(COMPARATORS);
export const KNOWN_UNSUPPORTED_RULES = ['headToHead', 'fairPlay'];