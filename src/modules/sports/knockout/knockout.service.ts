import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import {
  IKnockoutStageRepository,
  IKnockoutMatchRepository,
  KNOCKOUT_STAGE_REPOSITORY,
  KNOCKOUT_MATCH_REPOSITORY,
} from './interfaces/knockout-repository.interface';
import {
  KnockoutMatchStatus,
  KnockoutTargetSlot,
  KnockoutMatchDocument,
} from './schemas/knockout-match.schema';
import { KnockoutStageStatus } from './schemas/knockout-stage.schema';
import { CreateKnockoutBracketDto } from './dto/create-knockout-bracket.dto';
import { GenerateBracketDto } from './dto/generate-bracket.dto';

import { FixturesService } from '../fixtures/fixtures.service';
import {
  FixtureStage,
  TeamSlot,
  TeamSlotType,
} from '../fixtures/schemas/fixture.schema';
import { GroupsService } from '../groups/groups.service';
import { StandingsService, StandingRow } from '../standings/standings.service';
import { TeamsService } from '../teams/teams.service';
import { MatchResult } from '../matches/schemas/match.schema';

// =========================================================
// STAGE CONFIG
// =========================================================

/** How many teams a stage needs when it is the OPENING stage. */
const STAGE_CAPACITY: Record<string, number> = {
  final: 2,
  semi_final: 4,
  quarter_final: 8,
  round_of_16: 16,
  round_of_32: 32,
  round_of_64: 64,
};

const STAGE_ORDER: Record<string, number> = {
  preliminary: 0,
  round_of_64: 1,
  round_of_32: 2,
  round_of_16: 3,
  quarter_final: 4,
  semi_final: 5,
  third_place: 6,
  final: 7,
};

const STAGE_LABELS: Record<string, string> = {
  preliminary: 'Preliminary Round',
  round_of_64: 'Round of 64',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-final',
  semi_final: 'Semi-final',
  third_place: 'Third Place',
  final: 'Final',
};

const NEXT_STAGE: Record<string, string | null> = {
  round_of_64: 'round_of_32',
  round_of_32: 'round_of_16',
  round_of_16: 'quarter_final',
  quarter_final: 'semi_final',
  semi_final: 'final',
  final: null,
};

const OPENING_STAGES_MESSAGE =
  'Choose preliminary, round_of_64, round_of_32, round_of_16, quarter_final, semi_final or final.';

// =========================================================
// PUBLIC BRACKET VIEW
// =========================================================

export interface PublicBracketSlot {
  /** 'team' once the team is known, otherwise a readable placeholder. */
  type: 'team' | 'placeholder';
  teamId: string | null;
  teamName: string | null;
  /** Always safe to display, e.g. "Tomato FC" or "Winner of Semi-final 1". */
  label: string;
}

export interface PublicBracketMatch {
  id: string;
  position: number;
  status: string;
  fixtureId: string | null;
  home: PublicBracketSlot;
  away: PublicBracketSlot;
  /** Where the winner goes next, or null for the final. */
  winnerGoesTo: { stage: string; position: number; slot: string } | null;
}

export interface PublicBracketStage {
  stage: string;
  label: string;
  order: number;
  status: string;
  matches: PublicBracketMatch[];
}

export interface PublicBracket {
  tournamentId: string;
  hasBracket: boolean;
  /** The stage currently being played, or null if none is active. */
  currentStage: string | null;
  /** True when every stage of the bracket is complete. */
  completed: boolean;
  stages: PublicBracketStage[];
}

// =========================================================
// INTERNAL TYPES
// =========================================================

interface QualifiedTeam {
  teamId: string;
  groupId?: string;
  groupPosition?: number;
  /** Index of the group in the tournament's group list (A=0, B=1, ...). */
  groupOrder?: number;
  /** True for cross-group "best next-placed" qualifiers. */
  isAdditional?: boolean;
  teamName?: string;
  seed?: number;
  points?: number;
  goalDifference?: number;
  goalsFor?: number;
  wins?: number;
  played?: number;
}

type GroupLikeWithLegacyName = {
  name?: string | null;
  groupName?: string | null;
  _id?: Types.ObjectId | string;
  id?: string;
};

interface GroupStandingBucket {
  group: GroupLikeWithLegacyName;
  standings: StandingRow[];
}

const getGroupDisplayName = (
  group: GroupLikeWithLegacyName | null | undefined,
  fallback: string,
): string => String(group?.name ?? (group as any)?.groupName ?? fallback);

interface BracketMatchDefinition {
  stage: FixtureStage;
  position: number;
  homeSource: TeamSlot;
  awaySource: TeamSlot;
  winnerFeedsToPosition?: number | null;
  winnerFeedsToStage?: FixtureStage | null;
  winnerFeedsToSlot?: KnockoutTargetSlot | null;
  loserFeedsToPosition?: number | null;
  loserFeedsToStage?: FixtureStage | null;
  loserFeedsToSlot?: KnockoutTargetSlot | null;
}

interface BracketGenerationResult {
  matches: BracketMatchDefinition[];
  bracketSize: number;
  preliminaryMatches: number;
  firstKnockoutStage: FixtureStage;
  totalQualifiers: number;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class KnockoutService {
  private readonly logger = new Logger(KnockoutService.name);

  constructor(
    @Inject(KNOCKOUT_STAGE_REPOSITORY)
    private readonly stageRepo: IKnockoutStageRepository,

    @Inject(KNOCKOUT_MATCH_REPOSITORY)
    private readonly knockoutMatchRepo: IKnockoutMatchRepository,

    private readonly fixturesService: FixturesService,
    private readonly groupsService: GroupsService,
    private readonly standingsService: StandingsService,
    private readonly teamsService: TeamsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // =========================================================
  // PUBLIC: LIST BRACKET
  // =========================================================

  async listForTournament(tournamentId: string, organizationId: string) {
    const matches = await this.knockoutMatchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );

    return [...matches].sort((a, b) => {
      const orderDiff = this.getStageOrder(a.stage) - this.getStageOrder(b.stage);
      return orderDiff !== 0 ? orderDiff : a.position - b.position;
    });
  }

  /**
   * Repairs legacy winner slots that contain a teamId but still have the
   * MATCH_WINNER/MATCH_LOSER type, then creates any now-resolvable fixtures.
   */
  async repairResolvedFixtures(
    tournamentId: string,
    organizationId: string,
  ) {
    const matches = await this.knockoutMatchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );
    const repaired: string[] = [];

    for (const match of matches) {
      const normalizeResolvedSource = (source: TeamSlot) => {
        if (
          source.teamId &&
          (source.type === TeamSlotType.MATCH_WINNER ||
            source.type === TeamSlotType.MATCH_LOSER)
        ) {
          return this.fixedSlot(source.teamId.toString());
        }
        return source;
      };

      const homeSource = normalizeResolvedSource(match.homeSource);
      const awaySource = normalizeResolvedSource(match.awaySource);
      const sourceChanged =
        homeSource.type !== match.homeSource.type ||
        awaySource.type !== match.awaySource.type;

      if (sourceChanged) {
        await this.knockoutMatchRepo.updateById(match._id.toString(), {
          'homeSource.type': homeSource.type,
          'homeSource.teamId': homeSource.teamId,
          'homeSource.groupId': homeSource.groupId,
          'homeSource.position': homeSource.position,
          'homeSource.sourceFixtureId': homeSource.sourceFixtureId,
          'awaySource.type': awaySource.type,
          'awaySource.teamId': awaySource.teamId,
          'awaySource.groupId': awaySource.groupId,
          'awaySource.position': awaySource.position,
          'awaySource.sourceFixtureId': awaySource.sourceFixtureId,
          status: this.canResolveFixture(homeSource, awaySource)
            ? KnockoutMatchStatus.READY
            : KnockoutMatchStatus.PENDING,
        } as any);
        repaired.push(match._id.toString());
      }

      if (this.canResolveFixture(homeSource, awaySource) && !match.fixtureId) {
        await this.tryResolveAndCreateFixture(
          match._id.toString(),
          organizationId,
          tournamentId,
        );
      }
    }

    return { repairedMatchIds: repaired };
  }

  // =========================================================
  // PUBLIC: BRACKET VIEW (read-only, for public pages)
  //
  // Resolves team names and placeholder labels so the client
  // needs no extra calls, and leaves out tenant/internal ids.
  // =========================================================

  async getPublicBracket(
    tournamentId: string,
    organizationId: string,
  ): Promise<PublicBracket> {
    const [matches, stageDocs] = await Promise.all([
      this.knockoutMatchRepo.findByTournamentForTenant(
        tournamentId,
        organizationId,
      ),
      this.stageRepo.findByTournamentForTenant(tournamentId, organizationId),
    ]);

    if (matches.length === 0) {
      return {
        tournamentId,
        hasBracket: false,
        currentStage: null,
        completed: false,
        stages: [],
      };
    }

    const teams = await this.teamsService.listForTournament(
      organizationId,
      tournamentId,
    );

    const teamNames = new Map<string, string>();
    for (const team of teams as any[]) {
      const id = String(team._id ?? team.id ?? '');
      const name = team.name ?? team.teamName;
      if (id && name) teamNames.set(id, String(name));
    }

    // Group names are only needed for manually built brackets that use
    // "group position" slots.
    const usesGroupSlots = matches.some(
      (m) =>
        m.homeSource?.type === TeamSlotType.GROUP_POSITION ||
        m.awaySource?.type === TeamSlotType.GROUP_POSITION,
    );

    const groupNames = new Map<string, string>();
    if (usesGroupSlots) {
      const groups = await this.groupsService.listForTournament(
        organizationId,
        tournamentId,
      );
      for (const group of groups as any[]) {
        const id = String(group._id ?? group.id ?? '');
        if (id) groupNames.set(id, getGroupDisplayName(group, id));
      }
    }

    const stageStatus = new Map<string, string>(
      stageDocs.map((doc) => [this.normalizeStage(doc.stage), String(doc.status)]),
    );

    const byStage = new Map<string, KnockoutMatchDocument[]>();
    for (const match of matches) {
      const key = this.normalizeStage(match.stage);
      byStage.set(key, [...(byStage.get(key) ?? []), match]);
    }

    const stages: PublicBracketStage[] = Array.from(byStage.entries())
      .sort(([a], [b]) => this.getStageOrder(a) - this.getStageOrder(b))
      .map(([stage, stageMatches]) => ({
        stage,
        label: this.stageLabel(stage),
        order: this.getStageOrder(stage),
        status: stageStatus.get(stage) ?? 'pending',
        matches: [...stageMatches]
          .sort((a, b) => a.position - b.position)
          .map((match) => ({
            id: this.getId(match._id),
            position: match.position,
            status: String(match.status),
            fixtureId: match.fixtureId ? this.getId(match.fixtureId) : null,
            home: this.toPublicSlot(match, 'home', matches, teamNames, groupNames),
            away: this.toPublicSlot(match, 'away', matches, teamNames, groupNames),
            winnerGoesTo:
              match.winnerFeedsToStage && match.winnerFeedsToPosition
                ? {
                    stage: this.normalizeStage(match.winnerFeedsToStage),
                    position: match.winnerFeedsToPosition,
                    slot: String(match.winnerFeedsToSlot ?? KnockoutTargetSlot.HOME),
                  }
                : null,
          })),
      }));

    return {
      tournamentId,
      hasBracket: true,
      currentStage: stages.find((st) => st.status === 'active')?.stage ?? null,
      completed: stages.every((st) => st.status === 'completed'),
      stages,
    };
  }

  private toPublicSlot(
    match: KnockoutMatchDocument,
    side: 'home' | 'away',
    allMatches: KnockoutMatchDocument[],
    teamNames: Map<string, string>,
    groupNames: Map<string, string>,
  ): PublicBracketSlot {
    const source: any = side === 'home' ? match.homeSource : match.awaySource;
    const placeholder = (label: string): PublicBracketSlot => ({
      type: 'placeholder',
      teamId: null,
      teamName: null,
      label,
    });

    if (source?.type === TeamSlotType.FIXED && source.teamId) {
      const teamId = String(source.teamId);
      const name = teamNames.get(teamId) ?? 'Unknown team';
      return { type: 'team', teamId, teamName: name, label: name };
    }

    if (
      source?.type === TeamSlotType.MATCH_WINNER ||
      source?.type === TeamSlotType.MATCH_LOSER
    ) {
      const isWinner = source.type === TeamSlotType.MATCH_WINNER;
      const stage = this.normalizeStage(match.stage);

      const feeder = allMatches.find((candidate) => {
        const feedsStage = isWinner
          ? candidate.winnerFeedsToStage
          : candidate.loserFeedsToStage;
        const feedsPosition = isWinner
          ? candidate.winnerFeedsToPosition
          : candidate.loserFeedsToPosition;
        const feedsSlot = isWinner
          ? candidate.winnerFeedsToSlot
          : candidate.loserFeedsToSlot;

        return (
          !!feedsStage &&
          this.normalizeStage(feedsStage) === stage &&
          feedsPosition === match.position &&
          feedsSlot === side
        );
      });

      const verb = isWinner ? 'Winner' : 'Loser';

      return placeholder(
        feeder
          ? `${verb} of ${this.stageLabel(feeder.stage)} ${feeder.position}`
          : `${verb} of previous match`,
      );
    }

    if (source?.type === TeamSlotType.GROUP_POSITION && source.position) {
      const group = source.groupId
        ? (groupNames.get(String(source.groupId)) ?? 'Group')
        : 'Group';
      return placeholder(
        `${group}: ${this.ordinal(Number(source.position))} place`,
      );
    }

    return placeholder('To be decided');
  }

  private stageLabel(stage: string): string {
    const key = this.normalizeStage(stage);
    return (
      STAGE_LABELS[key] ??
      key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  private ordinal(value: number): string {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    switch (value % 10) {
      case 1:
        return `${value}st`;
      case 2:
        return `${value}nd`;
      case 3:
        return `${value}rd`;
      default:
        return `${value}th`;
    }
  }

  // =========================================================
  // PUBLIC: CREATE MANUAL BRACKET
  // =========================================================

  async createBracket(
    tournamentId: string,
    organizationId: string,
    dto: CreateKnockoutBracketDto,
  ) {
    if (!dto.matches || dto.matches.length === 0) {
      throw new BadRequestException('At least one knockout match is required.');
    }

    await this.assertNoExistingBracket(tournamentId, organizationId);

    const normalizedInputs = dto.matches.map((m: any) => ({
      ...m,
      stage: this.normalizeStage(m.stage),
      winnerFeedsToStage: m.winnerFeedsToStage
        ? this.normalizeStage(m.winnerFeedsToStage)
        : null,
      loserFeedsToStage: m.loserFeedsToStage
        ? this.normalizeStage(m.loserFeedsToStage)
        : null,
    }));

    this.validateBracketDefinition(normalizedInputs);

    const definitions: BracketMatchDefinition[] = normalizedInputs.map(
      (m: any) => ({
        stage: m.stage as FixtureStage,
        position: m.position,
        homeSource: this.toSchemaTeamSlot(m.homeSource),
        awaySource: this.toSchemaTeamSlot(m.awaySource),
        winnerFeedsToPosition: m.winnerFeedsToPosition ?? null,
        winnerFeedsToStage: (m.winnerFeedsToStage as FixtureStage) ?? null,
        winnerFeedsToSlot: m.winnerFeedsToSlot ?? null,
        loserFeedsToPosition: m.loserFeedsToPosition ?? null,
        loserFeedsToStage: (m.loserFeedsToStage as FixtureStage) ?? null,
        loserFeedsToSlot: m.loserFeedsToSlot ?? null,
      }),
    );

    await this.persistBracket(tournamentId, organizationId, definitions);

    return this.listForTournament(tournamentId, organizationId);
  }

  // =========================================================
  // PUBLIC: GENERATE FROM STANDINGS
  //
  // The caller picks the OPENING stage. The number of teams
  // must match that stage:
  //   teams = (teamsPerGroup x groups) + additionalBestTeams
  // additionalBestTeams defaults to 0 (none).
  // =========================================================

  async generateFromStandings(
    tournamentId: string,
    organizationId: string,
    requestedStage: string,
    dto: GenerateBracketDto,
  ) {
    await this.assertNoExistingBracket(tournamentId, organizationId);

    // -------------------------------------------------------
    // 1. Stage is required and must be a known opening stage.
    // -------------------------------------------------------

    if (!requestedStage) {
      throw new BadRequestException(
        `A starting stage is required. ${OPENING_STAGES_MESSAGE}`,
      );
    }

    const stage = this.normalizeStage(requestedStage);

    if (stage !== 'preliminary' && !STAGE_CAPACITY[stage]) {
      throw new BadRequestException(
        `Unknown knockout stage "${requestedStage}". ${OPENING_STAGES_MESSAGE}`,
      );
    }

    // -------------------------------------------------------
    // 2. Registered teams (tournament scoped).
    // -------------------------------------------------------

    const registeredTeams = await this.teamsService.listForTournament(
      organizationId,
      tournamentId,
    );

    const registeredTeamIds = registeredTeams.map((team: any) =>
      this.getId(team._id ?? team.id),
    );

    if (registeredTeamIds.length < 2) {
      throw new BadRequestException(
        `Knockout generation requires at least 2 registered teams. Got ${registeredTeamIds.length}.`,
      );
    }

    const registeredSet = new Set(registeredTeamIds);

    // -------------------------------------------------------
    // 3. Work out who qualified.
    // -------------------------------------------------------

    const groups = await this.groupsService.listForTournament(
      organizationId,
      tournamentId,
    );

    let qualifiedTeams: QualifiedTeam[] = [];
    let automaticQualifiers = 0;
    let additionalQualifiers = 0;
    const warnings: string[] = [];
    let qualificationMode: 'auto' | 'manual' | 'all-teams' = 'all-teams';
    let rulesUsed: {
      teamsPerGroup: number | null;
      additionalBestTeams: number;
    } | null = null;

    if (groups && groups.length > 0) {
      // GROUP + STANDINGS MODE
      //
      // If the organizer gave no qualification numbers, work them
      // out from the chosen stage (see resolveQualificationRules).
      const effectiveDto = this.resolveQualificationRules(
        stage,
        groups.length,
        dto,
      );

      qualificationMode = effectiveDto === dto ? 'manual' : 'auto';
      rulesUsed = {
        teamsPerGroup: effectiveDto.groupRules?.length
          ? null
          : (effectiveDto.teamsPerGroup ?? 2),
        additionalBestTeams: effectiveDto.additionalBestTeams ?? 0,
      };

      const standingsByGroup: GroupStandingBucket[] = [];

      for (const group of groups) {
        const groupId = this.getId(group._id ?? group.id);

        const standings = await this.standingsService.calculate(
          organizationId,
          tournamentId,
          groupId,
        );

        // Standings must only contain teams registered in this tournament.
        // Dropping such rows would shift everyone below them up a place and
        // quietly promote the wrong teams, so refuse instead.
        const unregistered = standings.filter(
          (row: any) => !registeredSet.has(this.getId(row.teamId)),
        );

        if (unregistered.length > 0) {
          const groupName = getGroupDisplayName(group, groupId);

          throw new BadRequestException(
            `Group ${groupName} standings contain ${unregistered.length} team(s) that are not registered ` +
              `in this tournament. Fix the group's teams before generating the knockout.`,
          );
        }

        standingsByGroup.push({ group, standings });
      }

      // The knockout is built from the standings, so they must be real.
      warnings.push(
        ...this.checkGroupStandings(
          standingsByGroup,
          (dto as any).allowIncompleteGroups === true,
        ),
      );

      const qualification = this.calculateQualifiers(
        standingsByGroup,
        effectiveDto,
      );

      warnings.push(...qualification.warnings);

      qualifiedTeams = qualification.qualified;
      automaticQualifiers = qualification.automaticQualifiers;
      additionalQualifiers = qualification.additionalQualifiers;
    } else {
      // KNOCKOUT-ONLY MODE: every registered team, in registration order.
      qualifiedTeams = registeredTeams.map((team: any) => ({
        teamId: this.getId(team._id ?? team.id),
        teamName: team.name ?? team.teamName ?? undefined,
      }));
      automaticQualifiers = qualifiedTeams.length;

      warnings.push(
        `No groups were found for this tournament, so all ${qualifiedTeams.length} registered teams ` +
          `were treated as a knockout-only draw and seeded in registration order. ` +
          `If this tournament has a group stage, the groups are not being found.`,
      );
    }

    const knockoutOnly = !(groups && groups.length > 0);

    qualifiedTeams = this.uniqueQualifiedTeams(qualifiedTeams).filter((t) =>
      registeredSet.has(t.teamId),
    );

    if (qualifiedTeams.length < 2) {
      throw new BadRequestException(
        `Knockout generation requires at least 2 qualified teams. Got ${qualifiedTeams.length}.`,
      );
    }

    // -------------------------------------------------------
    // 4. The qualified teams must fit the chosen stage.
    //
    // By default the count must match EXACTLY: nothing is dropped
    // silently and no team is invented. The organizer can opt in to
    // cutting the lowest-ranked extras with allowTrimExcessTeams=true;
    // the cut teams are then reported in the response.
    // -------------------------------------------------------

    // Trimming needs standings to rank by. Without groups there is nothing
    // to rank on, so it would just drop teams in registration order.
    const allowTrim =
      (dto as any).allowTrimExcessTeams === true && !knockoutOnly;

    this.validateStageCapacity(
      stage,
      qualifiedTeams.length,
      automaticQualifiers,
      additionalQualifiers,
      allowTrim,
      knockoutOnly,
    );

    // -------------------------------------------------------
    // 5. Seed, (optionally trim), build, persist.
    // -------------------------------------------------------

    const rankedQualifiers = this.seedQualifiers(qualifiedTeams);
    const qualifiedBeforeTrim = rankedQualifiers.length;

    const seeded =
      stage !== 'preliminary' && qualifiedBeforeTrim > STAGE_CAPACITY[stage]
        ? rankedQualifiers.slice(0, STAGE_CAPACITY[stage])
        : rankedQualifiers;

    const cutOffTeams = rankedQualifiers.slice(seeded.length);
    const teamsCutOff = cutOffTeams.length;

    if (teamsCutOff > 0) {
      warnings.push(
        `${qualifiedBeforeTrim} teams qualified but ${stage} holds ${seeded.length}; ` +
          `${teamsCutOff} lowest-ranked team(s) were left out because allowTrimExcessTeams was set.`,
      );
    }

    const bracket = this.buildBracketFromStage(seeded, stage);

    await this.persistBracket(tournamentId, organizationId, bracket.matches);

    return {
      success: true,
      tournamentId,
      requestedStage: stage,
      totalTeams: registeredTeamIds.length,
      totalGroups: groups?.length ?? 0,
      automaticQualifiers,
      additionalQualifiers,
      qualifiedBeforeTrim,
      teamsCutOff,
      totalKnockoutQualifiers: bracket.totalQualifiers,
      bracketSize: bracket.bracketSize,
      preliminaryMatches: bracket.preliminaryMatches,
      hasByes: bracket.bracketSize > bracket.totalQualifiers,
      firstKnockoutStage: bracket.firstKnockoutStage,
      matchesCreated: bracket.matches.length,
      qualificationMode,
      rulesUsed,
      warnings,
      cutOffTeams: cutOffTeams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        groupId: team.groupId ?? null,
        groupPosition: team.groupPosition ?? null,
      })),
      // Who actually entered the bracket, in seed order.
      qualifiedTeams: seeded.map((team) => ({
        seed: team.seed,
        teamId: team.teamId,
        teamName: team.teamName,
        groupId: team.groupId ?? null,
        groupPosition: team.groupPosition ?? null,
      })),
    };
  }

  // =========================================================
  // QUALIFICATION ENGINE
  // =========================================================

  private calculateQualifiers(
    standingsByGroup: GroupStandingBucket[],
    dto: GenerateBracketDto,
  ) {
    const qualified: QualifiedTeam[] = [];
    const additionalCandidates: QualifiedTeam[] = [];
    const warnings: string[] = [];
    const rules = dto.groupRules ?? [];

    standingsByGroup.forEach((bucket, groupIndex) => {
      const standings = bucket.standings ?? [];
      const groupId = this.getId(bucket.group._id ?? bucket.group.id);
      const groupName = getGroupDisplayName(bucket.group, groupId);

      const teamsPerGroup =
        rules[groupIndex]?.teamsPerGroup ?? dto.teamsPerGroup ?? 2;

      if (!Number.isInteger(teamsPerGroup) || teamsPerGroup < 0) {
        throw new BadRequestException(
          'teamsPerGroup must be a whole number of 0 or more.',
        );
      }

      // Never invent qualifiers: a group must really have the teams.
      if (standings.length < teamsPerGroup) {
        throw new BadRequestException(
          `Group ${groupName} has only ${standings.length} team(s) in its standings, ` +
            `but ${teamsPerGroup} are required to qualify.`,
        );
      }

      // The standings order IS the ranking (points, goal difference,
      // goals scored, head-to-head ... as configured in the standings
      // engine). We take it as is and never re-sort within a group.
      standings.slice(0, teamsPerGroup).forEach((row: any, i) => {
        if (!row?.teamId) {
          throw new BadRequestException(
            `Group ${groupName} standings contain a row without a team id.`,
          );
        }

        qualified.push({
          teamId: this.getId(row.teamId),
          groupId,
          groupOrder: groupIndex,
          groupPosition: i + 1,
          teamName: row.teamName ?? row.name ?? undefined,
          ...this.getStandingRankingFields(row),
        });
      });

      // Only the NEXT position in each group is eligible as an
      // "additional" team (e.g. best 3rd-placed when 2 go through).
      const next: any = standings[teamsPerGroup];
      const lastIn: any = teamsPerGroup > 0 ? standings[teamsPerGroup - 1] : null;

      // The last qualifier and the first non-qualifier are level on every
      // numeric criterion: the cut relies on the standings engine's own
      // tie-break rules (head-to-head, etc.). Surface that to the organizer.
      if (
        lastIn &&
        next &&
        (lastIn.points ?? 0) === (next.points ?? 0) &&
        (lastIn.goalDifference ?? 0) === (next.goalDifference ?? 0) &&
        (lastIn.goalsFor ?? 0) === (next.goalsFor ?? 0)
      ) {
        warnings.push(
          `Group ${groupName}: the last qualifying team and the first non-qualifying team are level on points, ` +
            `goal difference and goals scored. The standings' tie-break rules decided it.`,
        );
      }

      if (next) {
        additionalCandidates.push({
          teamId: this.getId(next.teamId),
          groupId,
          groupOrder: groupIndex,
          groupPosition: teamsPerGroup + 1,
          isAdditional: true,
          teamName: next.teamName ?? next.name ?? undefined,
          ...this.getStandingRankingFields(next),
        });
      }
    });

    const automaticQualifiers = qualified.length;

    let additionalCount =
      dto.additionalBestTeams ??
      rules.reduce((total, r) => total + (r.additionalBestTeams ?? 0), 0);

    // Legacy flag: bestThirdPlaced=true with no explicit count = 1 extra team.
    if (dto.bestThirdPlaced === true && !additionalCount) {
      additionalCount = 1;
    }

    additionalCount = Math.max(0, additionalCount ?? 0);

    if (additionalCount > additionalCandidates.length) {
      throw new BadRequestException(
        `Requested ${additionalCount} additional qualifiers, but only ${additionalCandidates.length} eligible teams exist.`,
      );
    }

    const picked = [...additionalCandidates]
      .sort((a, b) => this.compareStandingRows(a, b))
      .slice(0, additionalCount);

    qualified.push(...picked);

    return {
      qualified,
      automaticQualifiers,
      additionalQualifiers: picked.length,
      warnings,
    };
  }

  // =========================================================
  // AUTO QUALIFICATION RULES
  //
  // When the organizer sends NO qualification numbers
  // (no teamsPerGroup, additionalBestTeams, groupRules or
  // bestThirdPlaced), derive them from the chosen stage:
  //
  //   teamsPerGroup       = floor(stageCapacity / groups)
  //   additionalBestTeams = stageCapacity % groups
  //
  //   semi_final,   2 groups -> top 2 per group, 0 extra
  //   quarter_final,4 groups -> top 2 per group, 0 extra
  //   quarter_final,3 groups -> top 2 per group + 2 best 3rd-placed
  //   semi_final,   5 groups -> 0 per group + 4 best group winners
  //
  // Any explicit number switches this off and the organizer's
  // numbers are used (extras are then cut by ranking).
  // =========================================================

  private resolveQualificationRules(
    stage: string,
    groupCount: number,
    dto: GenerateBracketDto,
  ): GenerateBracketDto {
    const hasManualRules =
      dto.teamsPerGroup !== undefined ||
      dto.additionalBestTeams !== undefined ||
      (dto.groupRules?.length ?? 0) > 0 ||
      dto.bestThirdPlaced === true;

    if (hasManualRules || stage === 'preliminary') return dto;

    const capacity = STAGE_CAPACITY[stage];

    if (!capacity || groupCount < 1) return dto;

    return {
      ...dto,
      teamsPerGroup: Math.floor(capacity / groupCount),
      additionalBestTeams: capacity % groupCount,
    } as GenerateBracketDto;
  }

  // =========================================================
  // STANDINGS READINESS
  //
  // The bracket is built from group standings, so make sure
  // they mean something:
  //  - a group where nobody has played is rejected
  //    (unless allowIncompleteGroups = true)
  //  - uneven games played only produces a warning
  //
  // Skipped when the standings rows carry no `played` number.
  // =========================================================

  private checkGroupStandings(
    standingsByGroup: GroupStandingBucket[],
    allowIncomplete: boolean,
  ): string[] {
    const warnings: string[] = [];
    const notStarted: string[] = [];

    for (const bucket of standingsByGroup) {
      const group = bucket.group ?? {};
      const name = String(
        getGroupDisplayName(group, this.getId(group._id ?? group.id)),
      );

      const rows = (bucket.standings ?? []) as any[];

      if (rows.length === 0) {
        notStarted.push(name);
        continue;
      }

      if (!rows.some((row) => typeof row.played === 'number')) continue;

      const played = rows.map((row) => Number(row.played ?? 0));

      if (played.every((count) => count === 0)) {
        notStarted.push(name);
        continue;
      }

      if (new Set(played).size > 1) {
        warnings.push(
          `Group ${name}: teams have played different numbers of matches ` +
            `(${Math.min(...played)} to ${Math.max(...played)}), so the standings may not be final.`,
        );
      }
    }

    if (notStarted.length > 0 && !allowIncomplete) {
      throw new BadRequestException(
        `No group matches have been played yet in: ${notStarted.join(', ')}. ` +
          `Finish the group stage so the standings are real, then generate the knockout.`,
      );
    }

    if (notStarted.length > 0) {
      warnings.push(
        `Groups with no matches played (seeded by default order): ${notStarted.join(', ')}.`,
      );
    }

    return warnings;
  }

  private validateStageCapacity(
    stage: string,
    total: number,
    automatic: number,
    additional: number,
    allowTrim = false,
    knockoutOnly = false,
  ) {
    if (knockoutOnly && stage !== 'preliminary' && total !== STAGE_CAPACITY[stage]) {
      throw new BadRequestException(
        `No groups were found for this tournament, so there are no standings to pick the best teams from. ` +
          `All ${total} registered teams would enter the knockout, but ${stage} holds ${STAGE_CAPACITY[stage]}. ` +
          `If this tournament has groups, they are not being found for this tournament and organization. ` +
          `Otherwise choose a stage that fits ${total} teams, or "preliminary".`,
      );
    }

    if (stage === 'preliminary') {
      if (total < 3) {
        throw new BadRequestException(
          'A preliminary round needs at least 3 teams.',
        );
      }
      if (this.nextPowerOfTwo(total) === total) {
        throw new BadRequestException(
          `${total} teams fit a full bracket exactly, so no preliminary round is needed. Choose ${this.getStageForTeamCount(total)} instead.`,
        );
      }
      return;
    }

    const capacity = STAGE_CAPACITY[stage];
    const breakdown =
      `(${automatic} from group positions + ${additional} additional)`;

    if (total < capacity) {
      throw new BadRequestException(
        `${stage} needs ${capacity} teams, but only ${total} qualified ${breakdown}. ` +
          `Increase the qualifiers per group or the additional qualifiers, or choose a stage with fewer teams.`,
      );
    }

    if (total > capacity && !allowTrim) {
      throw new BadRequestException(
        `${stage} holds ${capacity} teams, but ${total} qualified ${breakdown}. ` +
          `Reduce the qualifiers per group or the additional qualifiers, choose a bigger stage ` +
          `or "preliminary", or set allowTrimExcessTeams to cut the lowest-ranked teams.`,
      );
    }
  }

  // =========================================================
  // SEEDING
  //
  // Ranked by group position first (all winners, then all
  // runners-up, ...) and then by points / goal difference /
  // goals scored across groups.
  // =========================================================

  private seedQualifiers(qualifiers: QualifiedTeam[]): QualifiedTeam[] {
    // Knockout-only mode has no group info: keep registration order.
    const hasGroups = qualifiers.some((q) => q.groupPosition !== undefined);
    if (!hasGroups) {
      return qualifiers.map((team, index) => ({ ...team, seed: index + 1 }));
    }

    // Seeding strategy (documented and deterministic):
    //  1. Group position first: every group winner, then every runner-up...
    //  2. Automatic qualifiers in the same position are ordered by the
    //     group's order (A, B, C ...), so results never depend on goal
    //     counts across groups or on database order.
    //  3. Additional ("best next-placed") qualifiers come after automatic
    //     ones of the same position and are ordered against each other by
    //     points, goal difference, goals scored, wins.
    return [...qualifiers]
      .sort((a, b) => {
        const posDiff =
          (a.groupPosition ?? Number.MAX_SAFE_INTEGER) -
          (b.groupPosition ?? Number.MAX_SAFE_INTEGER);
        if (posDiff !== 0) return posDiff;

        if (!!a.isAdditional !== !!b.isAdditional) {
          return a.isAdditional ? 1 : -1;
        }

        if (a.isAdditional && b.isAdditional) {
          const stats = this.compareStandingRows(a, b);
          if (stats !== 0) return stats;
        }

        return (a.groupOrder ?? 0) - (b.groupOrder ?? 0);
      })
      .map((team, index) => ({ ...team, seed: index + 1 }));
  }

  /** Standard bracket order: 4 -> [1,4,2,3], 8 -> [1,8,4,5,2,7,3,6] */
  private seedOrder(size: number): number[] {
    let order = [1];
    while (order.length < size) {
      const next = order.length * 2;
      order = order.flatMap((s) => [s, next + 1 - s]);
    }
    return order;
  }

  /**
   * Within each pairing, the team from the earlier group is listed first
   * (home), so two groups give "A1 vs B2" and "A2 vs B1" every time.
   */
  private homeByGroupOrder(teams: QualifiedTeam[]): QualifiedTeam[] {
    const arr = [...teams];

    for (let i = 0; i < arr.length; i += 2) {
      const home = arr[i];
      const away = arr[i + 1];

      if (
        home?.groupOrder !== undefined &&
        away?.groupOrder !== undefined &&
        home.groupOrder > away.groupOrder
      ) {
        arr[i] = away;
        arr[i + 1] = home;
      }
    }

    return arr;
  }

  /** Swap away teams so two teams from one group don't meet in round one. */
  private avoidSameGroupClashes(teams: QualifiedTeam[]): QualifiedTeam[] {
    const arr = [...teams];
    const pairs = arr.length / 2;
    const clash = (a?: QualifiedTeam, b?: QualifiedTeam) =>
      !!a?.groupId && a.groupId === b?.groupId;

    for (let p = 0; p < pairs; p++) {
      if (!clash(arr[p * 2], arr[p * 2 + 1])) continue;

      for (let q = 0; q < pairs; q++) {
        if (q === p) continue;
        if (
          !clash(arr[p * 2], arr[q * 2 + 1]) &&
          !clash(arr[q * 2], arr[p * 2 + 1])
        ) {
          [arr[p * 2 + 1], arr[q * 2 + 1]] = [arr[q * 2 + 1], arr[p * 2 + 1]];
          break;
        }
      }
    }

    return arr;
  }

  // =========================================================
  // BRACKET BUILDERS
  // =========================================================

  private buildBracketFromStage(
    seeded: QualifiedTeam[],
    stage: string,
  ): BracketGenerationResult {
    if (stage === 'preliminary') {
      return this.buildPreliminaryBracket(seeded);
    }

    const ordered = this.homeByGroupOrder(
      this.avoidSameGroupClashes(
        this.seedOrder(seeded.length).map((s) => seeded[s - 1]),
      ),
    );

    const matches = this.buildFullStage(
      ordered.map((t) => this.fixedSlot(t.teamId)),
      stage as FixtureStage,
    );

    this.connectFollowingRounds(matches, stage as FixtureStage);

    return {
      matches,
      bracketSize: seeded.length,
      preliminaryMatches: 0,
      firstKnockoutStage: stage as FixtureStage,
      totalQualifiers: seeded.length,
    };
  }

  private buildPreliminaryBracket(
    seeded: QualifiedTeam[],
  ): BracketGenerationResult {
    const count = seeded.length;
    const bracketSize = this.nextPowerOfTwo(count);
    const firstFull = bracketSize / 2;
    const preliminaryCount = count - firstFull;
    const byeCount = bracketSize - count;

    const preliminaryStage = 'preliminary' as FixtureStage;
    const firstFullStage = this.getStageForTeamCount(firstFull);

    const byeTeams = seeded.slice(0, byeCount);
    const prelimTeams = seeded.slice(byeCount);

    const order = this.seedOrder(firstFull);
    const slots = new Array<TeamSlot>(firstFull);
    const matches: BracketMatchDefinition[] = [];

    // Top seeds get byes straight into the first full stage.
    byeTeams.forEach((team, i) => {
      slots[order.indexOf(i + 1)] = this.fixedSlot(team.teamId);
    });

    // Remaining teams play: best remaining vs worst remaining.
    // The winner of prelim i takes the "virtual seed" byeCount + 1 + i.
    for (let i = 0; i < preliminaryCount; i++) {
      const home = prelimTeams[i];
      const away = prelimTeams[prelimTeams.length - 1 - i];

      const slotIndex = order.indexOf(byeCount + 1 + i);

      matches.push({
        stage: preliminaryStage,
        position: i + 1,
        homeSource: this.fixedSlot(home.teamId),
        awaySource: this.fixedSlot(away.teamId),
        winnerFeedsToStage: firstFullStage,
        winnerFeedsToPosition: Math.floor(slotIndex / 2) + 1,
        winnerFeedsToSlot:
          slotIndex % 2 === 0
            ? KnockoutTargetSlot.HOME
            : KnockoutTargetSlot.AWAY,
      });

      slots[slotIndex] = this.winnerSlot(i + 1);
    }

    matches.push(...this.buildFullStage(slots, firstFullStage));
    this.connectFollowingRounds(matches, firstFullStage);

    return {
      matches,
      bracketSize,
      preliminaryMatches: preliminaryCount,
      firstKnockoutStage: firstFullStage,
      totalQualifiers: count,
    };
  }

  private buildFullStage(
    slots: TeamSlot[],
    stage: FixtureStage,
  ): BracketMatchDefinition[] {
    if (slots.length < 2 || slots.length % 2 !== 0) {
      throw new BadRequestException(`Invalid participant count for ${stage}.`);
    }

    const matches: BracketMatchDefinition[] = [];

    for (let index = 0; index < slots.length / 2; index++) {
      matches.push({
        stage,
        position: index + 1,
        homeSource: slots[index * 2],
        awaySource: slots[index * 2 + 1],
        winnerFeedsToPosition: null,
        winnerFeedsToStage: null,
        winnerFeedsToSlot: null,
        loserFeedsToPosition: null,
        loserFeedsToStage: null,
        loserFeedsToSlot: null,
      });
    }

    return matches;
  }

  private connectFollowingRounds(
    matches: BracketMatchDefinition[],
    firstStage: FixtureStage,
  ) {
    let currentStage = firstStage;

    while (true) {
      const nextStage = this.getNextStage(currentStage);
      if (!nextStage) break;

      const currentMatches = matches
        .filter((m) => m.stage === currentStage)
        .sort((a, b) => a.position - b.position);

      const nextMatchCount = currentMatches.length / 2;
      if (nextMatchCount < 1) break;

      for (let index = 0; index < nextMatchCount; index++) {
        const nextPosition = index + 1;
        const first = currentMatches[index * 2];
        const second = currentMatches[index * 2 + 1];

        first.winnerFeedsToStage = nextStage;
        first.winnerFeedsToPosition = nextPosition;
        first.winnerFeedsToSlot = KnockoutTargetSlot.HOME;

        second.winnerFeedsToStage = nextStage;
        second.winnerFeedsToPosition = nextPosition;
        second.winnerFeedsToSlot = KnockoutTargetSlot.AWAY;

        matches.push({
          stage: nextStage,
          position: nextPosition,
          homeSource: this.winnerSlot(first.position),
          awaySource: this.winnerSlot(second.position),
          winnerFeedsToPosition: null,
          winnerFeedsToStage: null,
          winnerFeedsToSlot: null,
          loserFeedsToPosition: null,
          loserFeedsToStage: null,
          loserFeedsToSlot: null,
        });
      }

      currentStage = nextStage;
    }
  }

  // =========================================================
  // PERSIST BRACKET (shared by manual + generated)
  // =========================================================

  private async persistBracket(
    tournamentId: string,
    organizationId: string,
    definitions: BracketMatchDefinition[],
  ) {
    const stages = Array.from(new Set(definitions.map((d) => d.stage))).sort(
      (a, b) => this.getStageOrder(a) - this.getStageOrder(b),
    );

    // Stages: the earliest one is ACTIVE, the rest PENDING.
    for (let index = 0; index < stages.length; index++) {
      const stage = stages[index];

      const existing = await this.stageRepo.findByStageForTenant(
        tournamentId,
        organizationId,
        stage,
      );
      if (existing) continue;

      await this.stageRepo.create({
        organizationId: new Types.ObjectId(organizationId),
        tournamentId: new Types.ObjectId(tournamentId),
        stage,
        order: this.getStageOrder(stage),
        status:
          index === 0
            ? KnockoutStageStatus.ACTIVE
            : KnockoutStageStatus.PENDING,
      } as any);
    }

    // Matches.
    const created: KnockoutMatchDocument[] = [];

    for (const def of definitions) {
      const match = await this.knockoutMatchRepo.create({
        organizationId: new Types.ObjectId(organizationId),
        tournamentId: new Types.ObjectId(tournamentId),
        stage: def.stage,
        position: def.position,
        fixtureId: null,
        homeSource: def.homeSource,
        awaySource: def.awaySource,
        winnerFeedsToPosition: def.winnerFeedsToPosition ?? null,
        winnerFeedsToStage: def.winnerFeedsToStage ?? null,
        winnerFeedsToSlot: def.winnerFeedsToSlot ?? null,
        loserFeedsToPosition: def.loserFeedsToPosition ?? null,
        loserFeedsToStage: def.loserFeedsToStage ?? null,
        loserFeedsToSlot: def.loserFeedsToSlot ?? null,
        status: this.canResolveFixture(def.homeSource, def.awaySource)
          ? KnockoutMatchStatus.READY
          : KnockoutMatchStatus.PENDING,
      } as any);

      created.push(match);
    }

    // Fixtures for matches whose two teams are already known.
    for (const match of created) {
      await this.tryResolveAndCreateFixture(
        match._id.toString(),
        organizationId,
        tournamentId,
      );
    }

    return created;
  }

  // =========================================================
  // MATCH FINISHED
  // =========================================================

  @OnEvent('match.finished')
  async handleMatchFinished(payload: {
    matchId: string;
    fixtureId: string;
    tournamentId: string;
    organizationId: string;
    homeTeamId: string;
    awayTeamId: string;
    result: MatchResult;
  }) {
    const { fixtureId, organizationId, tournamentId, result } = payload;

    // A knockout match cannot advance on a draw.
    if (result !== MatchResult.HOME_WIN && result !== MatchResult.AWAY_WIN) {
      return;
    }

    // The event carries the real fixture id, so look the knockout match up
    // by its fixture (NOT by the football match id).
    const knockoutMatch = await this.knockoutMatchRepo.findByFixtureForTenant(
      fixtureId,
      organizationId,
    );

    if (!knockoutMatch) return;

    // Idempotency: already processed.
    if (knockoutMatch.status === KnockoutMatchStatus.COMPLETED) return;

    const homeWon = result === MatchResult.HOME_WIN;
    const winnerTeamId = homeWon ? payload.homeTeamId : payload.awayTeamId;
    const loserTeamId = homeWon ? payload.awayTeamId : payload.homeTeamId;

    // Winner routing.
    if (knockoutMatch.winnerFeedsToStage && knockoutMatch.winnerFeedsToPosition) {
      await this.resolveSlotInto(
        tournamentId,
        organizationId,
        knockoutMatch.winnerFeedsToStage,
        knockoutMatch.winnerFeedsToPosition,
        knockoutMatch.winnerFeedsToSlot ?? KnockoutTargetSlot.HOME,
        winnerTeamId,
      );
    }

    // Loser routing (third-place / consolation brackets).
    if (knockoutMatch.loserFeedsToStage && knockoutMatch.loserFeedsToPosition) {
      await this.resolveSlotInto(
        tournamentId,
        organizationId,
        knockoutMatch.loserFeedsToStage,
        knockoutMatch.loserFeedsToPosition,
        knockoutMatch.loserFeedsToSlot ?? KnockoutTargetSlot.HOME,
        loserTeamId,
      );
    }

    await this.knockoutMatchRepo.updateById(knockoutMatch._id.toString(), {
      status: KnockoutMatchStatus.COMPLETED,
    } as any);

    await this.updateStageStatusAfterMatch(
      tournamentId,
      organizationId,
      knockoutMatch.stage,
    );
  }

  // =========================================================
  // RESOLVE SLOT
  // =========================================================

  private async resolveSlotInto(
    tournamentId: string,
    organizationId: string,
    stage: FixtureStage,
    position: number,
    targetSlot: KnockoutTargetSlot,
    teamId: string,
  ) {
    const target = await this.knockoutMatchRepo.findByPositionForTenant(
      tournamentId,
      organizationId,
      stage,
      position,
    );

    if (!target) {
      throw new NotFoundException(
        `Knockout match ${stage} #${position} was not found.`,
      );
    }

    const source = this.fixedSlot(teamId);
    const isHome = targetSlot === KnockoutTargetSlot.HOME;

    const homeSource = isHome ? source : target.homeSource;
    const awaySource = isHome ? target.awaySource : source;

    const updated = await this.knockoutMatchRepo.updateById(
      target._id.toString(),
      {
        ...(isHome
          ? {
              'homeSource.type': source.type,
              'homeSource.teamId': source.teamId,
              'homeSource.groupId': source.groupId,
              'homeSource.position': source.position,
              'homeSource.sourceFixtureId': source.sourceFixtureId,
            }
          : {
              'awaySource.type': source.type,
              'awaySource.teamId': source.teamId,
              'awaySource.groupId': source.groupId,
              'awaySource.position': source.position,
              'awaySource.sourceFixtureId': source.sourceFixtureId,
            }),
        status: this.canResolveFixture(homeSource, awaySource)
          ? KnockoutMatchStatus.READY
          : KnockoutMatchStatus.PENDING,
      } as any,
    );

    if (!updated) {
      throw new NotFoundException('Knockout match could not be updated.');
    }

    // Only create the fixture once both teams are known.
    if (this.canResolveFixture(updated.homeSource, updated.awaySource)) {
      await this.tryResolveAndCreateFixture(
        updated._id.toString(),
        organizationId,
        tournamentId,
      );
    }
  }

  // =========================================================
  // CREATE FIXTURE WHEN READY
  // =========================================================

  private async tryResolveAndCreateFixture(
    knockoutMatchId: string,
    organizationId: string,
    tournamentId: string,
  ) {
    const knockoutMatch = await this.knockoutMatchRepo.findByIdForTenant(
      knockoutMatchId,
      organizationId,
    );

    if (!knockoutMatch) return null;
    if (knockoutMatch.fixtureId) return knockoutMatch;

    if (
      !this.canResolveFixture(knockoutMatch.homeSource, knockoutMatch.awaySource)
    ) {
      return knockoutMatch;
    }

    const homeTeamId = knockoutMatch.homeSource.teamId;
    const awayTeamId = knockoutMatch.awaySource.teamId;

    if (!homeTeamId || !awayTeamId) return knockoutMatch;

    // Re-link an existing fixture if fixture creation previously succeeded
    // but the knockout match's fixtureId update did not.
    const existingFixture = (
      await this.fixturesService.listForTournament(
        tournamentId,
        organizationId,
        { stage: knockoutMatch.stage },
      )
    ).find(
      (candidate) =>
        candidate.homeSlot?.type === TeamSlotType.FIXED &&
        candidate.awaySlot?.type === TeamSlotType.FIXED &&
        String(candidate.homeSlot.teamId) === String(homeTeamId) &&
        String(candidate.awaySlot.teamId) === String(awayTeamId),
    );

    if (existingFixture) {
      return this.knockoutMatchRepo.updateById(knockoutMatchId, {
        fixtureId: existingFixture._id as any,
        status: KnockoutMatchStatus.READY,
      } as any);
    }

    const fixture = await this.fixturesService.create(
      tournamentId,
      organizationId,
      {
        stage: knockoutMatch.stage,
        homeSlot: this.fixedSlot(homeTeamId.toString()) as any,
        awaySlot: this.fixedSlot(awayTeamId.toString()) as any,
        scheduledAt: new Date().toISOString(),
      },
    );

    if (!fixture) return knockoutMatch;

    const fixtureId = this.getId((fixture as any)._id ?? (fixture as any).id);

    return this.knockoutMatchRepo.updateById(knockoutMatchId, {
      fixtureId: new Types.ObjectId(fixtureId),
      status: KnockoutMatchStatus.READY,
    } as any);
  }

  // =========================================================
  // STAGE STATUS
  //
  // The next stage is the next one that EXISTS for this
  // tournament (by order), so preliminary -> semi_final works
  // regardless of the opening stage.
  // =========================================================

  private async updateStageStatusAfterMatch(
    tournamentId: string,
    organizationId: string,
    stage: FixtureStage,
  ) {
    const matches = await this.knockoutMatchRepo.findByStageForTenant(
      tournamentId,
      organizationId,
      stage,
    );

    if (matches.length === 0) return;

    const stageDoc = await this.stageRepo.findByStageForTenant(
      tournamentId,
      organizationId,
      stage,
    );

    if (!stageDoc) return;

    const allCompleted = matches.every(
      (m) => m.status === KnockoutMatchStatus.COMPLETED,
    );

    await this.stageRepo.updateById(stageDoc._id.toString(), {
      status: allCompleted
        ? KnockoutStageStatus.COMPLETED
        : KnockoutStageStatus.ACTIVE,
    } as any);

    if (!allCompleted) return;

    const nextStageDoc = await this.stageRepo.findNextStageForTenant(
      tournamentId,
      organizationId,
      stageDoc.order,
    );

    if (nextStageDoc && nextStageDoc.status === KnockoutStageStatus.PENDING) {
      await this.stageRepo.updateById(nextStageDoc._id.toString(), {
        status: KnockoutStageStatus.ACTIVE,
      } as any);
    }
  }

  // =========================================================
  // SLOT HELPERS
  // =========================================================

  private fixedSlot(teamId: string): TeamSlot {
    return {
      type: TeamSlotType.FIXED,
      teamId: new Types.ObjectId(teamId),
      groupId: null,
      position: null,
      sourceFixtureId: null,
    };
  }

  /** Placeholder for "winner of match #position in the feeding stage". */
  private winnerSlot(position: number): TeamSlot {
    return {
      type: TeamSlotType.MATCH_WINNER,
      teamId: null,
      groupId: null,
      position,
      sourceFixtureId: null,
    };
  }

  private toSchemaTeamSlot(source: any): TeamSlot {
    return {
      type: source.type,
      teamId: source.teamId ? new Types.ObjectId(source.teamId) : null,
      groupId: source.groupId ? new Types.ObjectId(source.groupId) : null,
      position: source.position ?? null,
      sourceFixtureId: source.sourceFixtureId
        ? new Types.ObjectId(source.sourceFixtureId)
        : null,
    };
  }

  private canResolveFixture(homeSource: TeamSlot, awaySource: TeamSlot): boolean {
    return (
      homeSource.type === TeamSlotType.FIXED &&
      awaySource.type === TeamSlotType.FIXED &&
      !!homeSource.teamId &&
      !!awaySource.teamId
    );
  }

  // =========================================================
  // QUALIFIER HELPERS
  // =========================================================

  private uniqueQualifiedTeams(teams: QualifiedTeam[]): QualifiedTeam[] {
    const seen = new Set<string>();
    const result: QualifiedTeam[] = [];

    for (const team of teams) {
      if (!team.teamId || seen.has(team.teamId)) continue;
      seen.add(team.teamId);
      result.push(team);
    }

    return result;
  }

  private getStandingRankingFields(row: any) {
    return {
      points: row.points ?? 0,
      goalDifference: row.goalDifference ?? 0,
      goalsFor: row.goalsFor ?? 0,
      wins: row.wins ?? 0,
      played: row.played ?? 0,
    };
  }

  private compareStandingRows(a: any, b: any): number {
    const pointsDiff = (b.points ?? 0) - (a.points ?? 0);
    if (pointsDiff !== 0) return pointsDiff;

    const gdDiff = (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
    if (gdDiff !== 0) return gdDiff;

    const gfDiff = (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
    if (gfDiff !== 0) return gfDiff;

    const winsDiff = (b.wins ?? 0) - (a.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;

    return (
      (a.groupPosition ?? Number.MAX_SAFE_INTEGER) -
      (b.groupPosition ?? Number.MAX_SAFE_INTEGER)
    );
  }

  // =========================================================
  // STAGE HELPERS
  // =========================================================

  private normalizeStage(stage: string): string {
    const normalized = String(stage ?? '')
      .trim()
      .toLowerCase()
      .replace(/[ -]/g, '_');

    if (
      normalized === 'round_of_8' ||
      normalized === 'quarterfinal' ||
      normalized === 'quarter_finals' ||
      normalized === 'quarterfinals'
    ) {
      return 'quarter_final';
    }

    if (
      normalized === 'semifinal' ||
      normalized === 'semi_finals' ||
      normalized === 'semifinals'
    ) {
      return 'semi_final';
    }

    if (normalized === 'prelim' || normalized === 'preliminary_round') {
      return 'preliminary';
    }

    return normalized;
  }

  private getStageForTeamCount(participantCount: number): FixtureStage {
    const entry = Object.entries(STAGE_CAPACITY).find(
      ([, capacity]) => capacity === participantCount,
    );

    if (!entry) {
      throw new BadRequestException(
        `Unsupported knockout stage size: ${participantCount} teams.`,
      );
    }

    return entry[0] as FixtureStage;
  }

  private getNextStage(stage: FixtureStage): FixtureStage | null {
    return (NEXT_STAGE[this.normalizeStage(stage)] as FixtureStage) ?? null;
  }

  private getStageOrder(stage: FixtureStage | string): number {
    return STAGE_ORDER[this.normalizeStage(stage)] ?? 99;
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  /**
   * Generation never overwrites a bracket. If one exists we refuse, and
   * say precisely why, so completed or in-progress matches are protected.
   * (There is no reset endpoint: a reset would have to delete fixtures and
   * is deliberately not done implicitly.)
   */
  private async assertNoExistingBracket(
    tournamentId: string,
    organizationId: string,
  ) {
    const existing = await this.knockoutMatchRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );

    if (existing.length === 0) return;

    const completed = existing.filter(
      (m) => m.status === KnockoutMatchStatus.COMPLETED,
    ).length;
    const withFixtures = existing.filter((m) => !!m.fixtureId).length;

    throw new ConflictException(
      completed > 0
        ? `A knockout bracket already exists and ${completed} of its ${existing.length} matches are completed. ` +
            `It cannot be regenerated.`
        : `A knockout bracket already exists for this tournament (${existing.length} matches, ${withFixtures} fixtures). ` +
            `It was not changed. Regeneration needs an explicit reset, which is not available here.`,
    );
  }

  private validateBracketDefinition(
    matches: Array<{
      stage: string;
      position: number;
      homeSource: any;
      awaySource: any;
    }>,
  ) {
    const seen = new Set<string>();

    for (const match of matches) {
      if (!match.stage) {
        throw new BadRequestException('Every knockout match requires a stage.');
      }

      if (!Number.isInteger(match.position) || match.position <= 0) {
        throw new BadRequestException(
          'Knockout match positions must be positive integers.',
        );
      }

      const key = `${match.stage}:${match.position}`;

      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate knockout match position: ${key}.`,
        );
      }

      seen.add(key);

      this.validateTeamSlot(match.homeSource, 'homeSource');
      this.validateTeamSlot(match.awaySource, 'awaySource');
    }
  }

  private validateTeamSlot(source: any, field: string) {
    if (!source || !source.type) {
      throw new BadRequestException(`${field}.type is required.`);
    }

    if (source.type === TeamSlotType.FIXED && !source.teamId) {
      throw new BadRequestException(
        `${field}.teamId is required for a fixed team slot.`,
      );
    }

    if (
      source.type === TeamSlotType.GROUP_POSITION &&
      (!source.groupId || !source.position)
    ) {
      throw new BadRequestException(
        `${field} requires groupId and position for group-position slots.`,
      );
    }

    if (
      (source.type === TeamSlotType.MATCH_WINNER ||
        source.type === TeamSlotType.MATCH_LOSER) &&
      !source.position
    ) {
      throw new BadRequestException(
        `${field}.position is required for match-winner / match-loser slots.`,
      );
    }
  }

  // =========================================================
  // MISC
  // =========================================================

  private nextPowerOfTwo(value: number): number {
    let result = 1;
    while (result < value) result *= 2;
    return result;
  }

  private getId(value: any): string {
    if (value === undefined || value === null) {
      throw new BadRequestException('A required MongoDB identifier is missing.');
    }
    return value.toString();
  }
}

// import {
//   BadRequestException,
//   Inject,
//   Injectable,
//   Logger,
//   NotFoundException,
// } from '@nestjs/common';
// import { EventEmitter2 } from '@nestjs/event-emitter';
// import { Types } from 'mongoose';

// import {
//   IKnockoutStageRepository,
//   IKnockoutMatchRepository,
//   KNOCKOUT_STAGE_REPOSITORY,
//   KNOCKOUT_MATCH_REPOSITORY,
// } from './interfaces/knockout-repository.interface';
// import {
//   KnockoutMatchStatus,
//   KnockoutTargetSlot,
//   KnockoutMatchDocument,
// } from './schemas/knockout-match.schema';
// import { KnockoutStageStatus } from './schemas/knockout-stage.schema';
// import { CreateKnockoutBracketDto } from './dto/create-knockout-bracket.dto';
// import { GenerateBracketDto } from './dto/generate-bracket.dto';
// import { FixturesService } from '../fixtures/fixtures.service';
// import {
//   FixtureStage,
//   TeamSlot,
//   TeamSlotType,
// } from '../fixtures/schemas/fixture.schema';
// import { GroupsService } from '../groups/groups.service';
// import { StandingsService, StandingRow } from '../standings/standings.service';
// import { TeamsService } from '../teams/teams.service';
// import { MatchResult } from '../matches/schemas/match.schema';

// // =========================================================
// // STAGE CONFIG
// // =========================================================

// /** How many teams a stage needs when it is the OPENING stage. */
// const STAGE_CAPACITY: Record<string, number> = {
//   final: 2,
//   semi_final: 4,
//   quarter_final: 8,
//   round_of_16: 16,
//   round_of_32: 32,
//   round_of_64: 64,
// };

// const STAGE_ORDER: Record<string, number> = {
//   preliminary: 0,
//   round_of_64: 1,
//   round_of_32: 2,
//   round_of_16: 3,
//   quarter_final: 4,
//   semi_final: 5,
//   third_place: 6,
//   final: 7,
// };

// const NEXT_STAGE: Record<string, string | null> = {
//   round_of_64: 'round_of_32',
//   round_of_32: 'round_of_16',
//   round_of_16: 'quarter_final',
//   quarter_final: 'semi_final',
//   semi_final: 'final',
//   final: null,
// };

// const OPENING_STAGES_MESSAGE =
//   'Choose preliminary, round_of_64, round_of_32, round_of_16, quarter_final, semi_final or final.';

// // =========================================================
// // INTERNAL TYPES
// // =========================================================

// interface QualifiedTeam {
//   teamId: string;
//   groupId?: string;
//   groupPosition?: number;
//   teamName?: string;
//   seed?: number;
//   points?: number;
//   goalDifference?: number;
//   goalsFor?: number;
//   wins?: number;
//   played?: number;
// }

// interface GroupStandingBucket {
//   group: any;
//   standings: StandingRow[];
// }

// interface BracketMatchDefinition {
//   stage: FixtureStage;
//   position: number;
//   homeSource: TeamSlot;
//   awaySource: TeamSlot;
//   winnerFeedsToPosition?: number | null;
//   winnerFeedsToStage?: FixtureStage | null;
//   winnerFeedsToSlot?: KnockoutTargetSlot | null;
//   loserFeedsToPosition?: number | null;
//   loserFeedsToStage?: FixtureStage | null;
//   loserFeedsToSlot?: KnockoutTargetSlot | null;
// }

// interface BracketGenerationResult {
//   matches: BracketMatchDefinition[];
//   bracketSize: number;
//   preliminaryMatches: number;
//   firstKnockoutStage: FixtureStage;
//   totalQualifiers: number;
// }

// // =========================================================
// // SERVICE
// // =========================================================

// @Injectable()
// export class KnockoutService {
//   private readonly logger = new Logger(KnockoutService.name);

//   constructor(
//     @Inject(KNOCKOUT_STAGE_REPOSITORY)
//     private readonly stageRepo: IKnockoutStageRepository,

//     @Inject(KNOCKOUT_MATCH_REPOSITORY)
//     private readonly knockoutMatchRepo: IKnockoutMatchRepository,

//     private readonly fixturesService: FixturesService,
//     private readonly groupsService: GroupsService,
//     private readonly standingsService: StandingsService,
//     private readonly teamsService: TeamsService,
//     private readonly eventEmitter: EventEmitter2,
//   ) {}

//   // =========================================================
//   // PUBLIC: LIST BRACKET
//   // =========================================================

//   async listForTournament(tournamentId: string, organizationId: string) {
//     const matches = await this.knockoutMatchRepo.findByTournamentForTenant(
//       tournamentId,
//       organizationId,
//     );

//     return [...matches].sort((a, b) => {
//       const orderDiff = this.getStageOrder(a.stage) - this.getStageOrder(b.stage);
//       return orderDiff !== 0 ? orderDiff : a.position - b.position;
//     });
//   }

//   // =========================================================
//   // PUBLIC: CREATE MANUAL BRACKET
//   // =========================================================

//   async createBracket(
//     tournamentId: string,
//     organizationId: string,
//     dto: CreateKnockoutBracketDto,
//   ) {
//     if (!dto.matches || dto.matches.length === 0) {
//       throw new BadRequestException('At least one knockout match is required.');
//     }

//     await this.assertNoExistingBracket(tournamentId, organizationId);

//     const normalizedInputs = dto.matches.map((m: any) => ({
//       ...m,
//       stage: this.normalizeStage(m.stage),
//       winnerFeedsToStage: m.winnerFeedsToStage
//         ? this.normalizeStage(m.winnerFeedsToStage)
//         : null,
//       loserFeedsToStage: m.loserFeedsToStage
//         ? this.normalizeStage(m.loserFeedsToStage)
//         : null,
//     }));

//     this.validateBracketDefinition(normalizedInputs);

//     const definitions: BracketMatchDefinition[] = normalizedInputs.map(
//       (m: any) => ({
//         stage: m.stage as FixtureStage,
//         position: m.position,
//         homeSource: this.toSchemaTeamSlot(m.homeSource),
//         awaySource: this.toSchemaTeamSlot(m.awaySource),
//         winnerFeedsToPosition: m.winnerFeedsToPosition ?? null,
//         winnerFeedsToStage: (m.winnerFeedsToStage as FixtureStage) ?? null,
//         winnerFeedsToSlot: m.winnerFeedsToSlot ?? null,
//         loserFeedsToPosition: m.loserFeedsToPosition ?? null,
//         loserFeedsToStage: (m.loserFeedsToStage as FixtureStage) ?? null,
//         loserFeedsToSlot: m.loserFeedsToSlot ?? null,
//       }),
//     );

//     await this.persistBracket(tournamentId, organizationId, definitions);

//     return this.listForTournament(tournamentId, organizationId);
//   }

//   // =========================================================
//   // PUBLIC: GENERATE FROM STANDINGS
//   //
//   // The caller picks the OPENING stage. The number of teams
//   // must match that stage:
//   //   teams = (teamsPerGroup x groups) + additionalBestTeams
//   // additionalBestTeams defaults to 0 (none).
//   // =========================================================

//   async generateFromStandings(
//     tournamentId: string,
//     organizationId: string,
//     requestedStage: string,
//     dto: GenerateBracketDto,
//   ) {
//     await this.assertNoExistingBracket(tournamentId, organizationId);

//     // -------------------------------------------------------
//     // 1. Stage is required and must be a known opening stage.
//     // -------------------------------------------------------

//     if (!requestedStage) {
//       throw new BadRequestException(
//         `A starting stage is required. ${OPENING_STAGES_MESSAGE}`,
//       );
//     }

//     const stage = this.normalizeStage(requestedStage);

//     if (stage !== 'preliminary' && !STAGE_CAPACITY[stage]) {
//       throw new BadRequestException(
//         `Unknown knockout stage "${requestedStage}". ${OPENING_STAGES_MESSAGE}`,
//       );
//     }

//     // -------------------------------------------------------
//     // 2. Registered teams (tournament scoped).
//     // -------------------------------------------------------

//     const registeredTeams = await this.teamsService.listForTournament(
//       organizationId,
//       tournamentId,
//     );

//     const registeredTeamIds = registeredTeams.map((team: any) =>
//       this.getId(team._id ?? team.id),
//     );

//     if (registeredTeamIds.length < 2) {
//       throw new BadRequestException(
//         `Knockout generation requires at least 2 registered teams. Got ${registeredTeamIds.length}.`,
//       );
//     }

//     const registeredSet = new Set(registeredTeamIds);

//     // -------------------------------------------------------
//     // 3. Work out who qualified.
//     // -------------------------------------------------------

//     const groups = await this.groupsService.listForTournament(
//       organizationId,
//       tournamentId,
//     );

//     let qualifiedTeams: QualifiedTeam[] = [];
//     let automaticQualifiers = 0;
//     let additionalQualifiers = 0;

//     if (groups && groups.length > 0) {
//       // GROUP + STANDINGS MODE
//       const standingsByGroup: GroupStandingBucket[] = [];

//       for (const group of groups) {
//         const groupId = this.getId(group._id ?? group.id);

//         const standings = await this.standingsService.calculate(
//           organizationId,
//           tournamentId,
//           groupId,
//         );

//         standingsByGroup.push({
//           group,
//           standings: standings.filter((row: any) =>
//             registeredSet.has(this.getId(row.teamId)),
//           ),
//         });
//       }

//       const qualification = this.calculateQualifiers(standingsByGroup, dto);

//       qualifiedTeams = qualification.qualified;
//       automaticQualifiers = qualification.automaticQualifiers;
//       additionalQualifiers = qualification.additionalQualifiers;
//     } else {
//       // KNOCKOUT-ONLY MODE: every registered team, in registration order.
//       qualifiedTeams = registeredTeams.map((team: any) => ({
//         teamId: this.getId(team._id ?? team.id),
//         teamName: team.name ?? team.teamName ?? undefined,
//       }));
//       automaticQualifiers = qualifiedTeams.length;
//     }

//     qualifiedTeams = this.uniqueQualifiedTeams(qualifiedTeams).filter((t) =>
//       registeredSet.has(t.teamId),
//     );

//     if (qualifiedTeams.length < 2) {
//       throw new BadRequestException(
//         `Knockout generation requires at least 2 qualified teams. Got ${qualifiedTeams.length}.`,
//       );
//     }

//     // -------------------------------------------------------
//     // 4. Stage must match the number of teams.
//     // -------------------------------------------------------

//     this.validateStageCapacity(
//       stage,
//       qualifiedTeams.length,
//       automaticQualifiers,
//       additionalQualifiers,
//     );

//     // -------------------------------------------------------
//     // 5. Seed, build from the chosen stage, persist.
//     // -------------------------------------------------------

//     const seeded = this.seedQualifiers(qualifiedTeams);
//     const bracket = this.buildBracketFromStage(seeded, stage);

//     await this.persistBracket(tournamentId, organizationId, bracket.matches);

//     return {
//       success: true,
//       tournamentId,
//       requestedStage: stage,
//       totalTeams: registeredTeamIds.length,
//       totalGroups: groups?.length ?? 0,
//       automaticQualifiers,
//       additionalQualifiers,
//       totalKnockoutQualifiers: bracket.totalQualifiers,
//       bracketSize: bracket.bracketSize,
//       preliminaryMatches: bracket.preliminaryMatches,
//       hasByes: bracket.bracketSize > bracket.totalQualifiers,
//       firstKnockoutStage: bracket.firstKnockoutStage,
//       matchesCreated: bracket.matches.length,
//     };
//   }

//   // =========================================================
//   // QUALIFICATION ENGINE
//   // =========================================================

//   private calculateQualifiers(
//     standingsByGroup: GroupStandingBucket[],
//     dto: GenerateBracketDto,
//   ) {
//     const qualified: QualifiedTeam[] = [];
//     const additionalCandidates: QualifiedTeam[] = [];
//     const rules = dto.groupRules ?? [];

//     standingsByGroup.forEach((bucket, groupIndex) => {
//       const standings = bucket.standings ?? [];
//       const groupId = this.getId(bucket.group._id ?? bucket.group.id);

//       const teamsPerGroup =
//         rules[groupIndex]?.teamsPerGroup ?? dto.teamsPerGroup ?? 2;

//       if (teamsPerGroup < 0) {
//         throw new BadRequestException('teamsPerGroup cannot be negative.');
//       }

//       standings.slice(0, teamsPerGroup).forEach((row: any, i) => {
//         qualified.push({
//           teamId: this.getId(row.teamId),
//           groupId,
//           groupPosition: i + 1,
//           teamName: row.teamName ?? row.name ?? undefined,
//           ...this.getStandingRankingFields(row),
//         });
//       });

//       // Only the NEXT position in each group is eligible as an
//       // "additional" team (e.g. best 3rd-placed when 2 go through).
//       const next: any = standings[teamsPerGroup];
//       if (next) {
//         additionalCandidates.push({
//           teamId: this.getId(next.teamId),
//           groupId,
//           groupPosition: teamsPerGroup + 1,
//           teamName: next.teamName ?? next.name ?? undefined,
//           ...this.getStandingRankingFields(next),
//         });
//       }
//     });

//     const automaticQualifiers = qualified.length;

//     let additionalCount =
//       dto.additionalBestTeams ??
//       rules.reduce((total, r) => total + (r.additionalBestTeams ?? 0), 0);

//     // Legacy flag: bestThirdPlaced=true with no explicit count = 1 extra team.
//     if (dto.bestThirdPlaced === true && !additionalCount) {
//       additionalCount = 1;
//     }

//     additionalCount = Math.max(0, additionalCount ?? 0);

//     if (additionalCount > additionalCandidates.length) {
//       throw new BadRequestException(
//         `Requested ${additionalCount} additional qualifiers, but only ${additionalCandidates.length} eligible teams exist.`,
//       );
//     }

//     const picked = [...additionalCandidates]
//       .sort((a, b) => this.compareStandingRows(a, b))
//       .slice(0, additionalCount);

//     qualified.push(...picked);

//     return {
//       qualified,
//       automaticQualifiers,
//       additionalQualifiers: picked.length,
//     };
//   }

//   private validateStageCapacity(
//     stage: string,
//     total: number,
//     automatic: number,
//     additional: number,
//   ) {
//     if (stage === 'preliminary') {
//       if (total < 3) {
//         throw new BadRequestException(
//           'A preliminary round needs at least 3 teams.',
//         );
//       }
//       if (this.nextPowerOfTwo(total) === total) {
//         throw new BadRequestException(
//           `${total} teams fit a full bracket exactly, so no preliminary round is needed. Choose ${this.getStageForTeamCount(total)} instead.`,
//         );
//       }
//       return;
//     }

//     const capacity = STAGE_CAPACITY[stage];

//     if (total !== capacity) {
//       throw new BadRequestException(
//         `${stage} needs exactly ${capacity} teams, but you have ${total} ` +
//           `(${automatic} from group positions + ${additional} additional). ` +
//           `Adjust teamsPerGroup or additionalBestTeams, or use "preliminary" for uneven counts.`,
//       );
//     }
//   }

//   // =========================================================
//   // SEEDING
//   //
//   // Ranked by group position first (all winners, then all
//   // runners-up, ...) and then by points / goal difference /
//   // goals scored across groups.
//   // =========================================================

//   private seedQualifiers(qualifiers: QualifiedTeam[]): QualifiedTeam[] {
//     // Knockout-only mode has no group info: keep registration order.
//     const hasGroups = qualifiers.some((q) => q.groupPosition !== undefined);
//     if (!hasGroups) {
//       return qualifiers.map((team, index) => ({ ...team, seed: index + 1 }));
//     }

//     return [...qualifiers]
//       .sort((a, b) => {
//         const posDiff =
//           (a.groupPosition ?? Number.MAX_SAFE_INTEGER) -
//           (b.groupPosition ?? Number.MAX_SAFE_INTEGER);
//         if (posDiff !== 0) return posDiff;
//         return this.compareStandingRows(a, b);
//       })
//       .map((team, index) => ({ ...team, seed: index + 1 }));
//   }

//   /** Standard bracket order: 4 -> [1,4,2,3], 8 -> [1,8,4,5,2,7,3,6] */
//   private seedOrder(size: number): number[] {
//     let order = [1];
//     while (order.length < size) {
//       const next = order.length * 2;
//       order = order.flatMap((s) => [s, next + 1 - s]);
//     }
//     return order;
//   }

//   /** Swap away teams so two teams from one group don't meet in round one. */
//   private avoidSameGroupClashes(teams: QualifiedTeam[]): QualifiedTeam[] {
//     const arr = [...teams];
//     const pairs = arr.length / 2;
//     const clash = (a?: QualifiedTeam, b?: QualifiedTeam) =>
//       !!a?.groupId && a.groupId === b?.groupId;

//     for (let p = 0; p < pairs; p++) {
//       if (!clash(arr[p * 2], arr[p * 2 + 1])) continue;

//       for (let q = 0; q < pairs; q++) {
//         if (q === p) continue;
//         if (
//           !clash(arr[p * 2], arr[q * 2 + 1]) &&
//           !clash(arr[q * 2], arr[p * 2 + 1])
//         ) {
//           [arr[p * 2 + 1], arr[q * 2 + 1]] = [arr[q * 2 + 1], arr[p * 2 + 1]];
//           break;
//         }
//       }
//     }

//     return arr;
//   }

//   // =========================================================
//   // BRACKET BUILDERS
//   // =========================================================

//   private buildBracketFromStage(
//     seeded: QualifiedTeam[],
//     stage: string,
//   ): BracketGenerationResult {
//     if (stage === 'preliminary') {
//       return this.buildPreliminaryBracket(seeded);
//     }

//     const ordered = this.avoidSameGroupClashes(
//       this.seedOrder(seeded.length).map((s) => seeded[s - 1]),
//     );

//     const matches = this.buildFullStage(
//       ordered.map((t) => this.fixedSlot(t.teamId)),
//       stage as FixtureStage,
//     );

//     this.connectFollowingRounds(matches, stage as FixtureStage);

//     return {
//       matches,
//       bracketSize: seeded.length,
//       preliminaryMatches: 0,
//       firstKnockoutStage: stage as FixtureStage,
//       totalQualifiers: seeded.length,
//     };
//   }

//   private buildPreliminaryBracket(
//     seeded: QualifiedTeam[],
//   ): BracketGenerationResult {
//     const count = seeded.length;
//     const bracketSize = this.nextPowerOfTwo(count);
//     const firstFull = bracketSize / 2;
//     const preliminaryCount = count - firstFull;
//     const byeCount = bracketSize - count;

//     const preliminaryStage = 'preliminary' as FixtureStage;
//     const firstFullStage = this.getStageForTeamCount(firstFull);

//     const byeTeams = seeded.slice(0, byeCount);
//     const prelimTeams = seeded.slice(byeCount);

//     const order = this.seedOrder(firstFull);
//     const slots = new Array<TeamSlot>(firstFull);
//     const matches: BracketMatchDefinition[] = [];

//     // Top seeds get byes straight into the first full stage.
//     byeTeams.forEach((team, i) => {
//       slots[order.indexOf(i + 1)] = this.fixedSlot(team.teamId);
//     });

//     // Remaining teams play: best remaining vs worst remaining.
//     // The winner of prelim i takes the "virtual seed" byeCount + 1 + i.
//     for (let i = 0; i < preliminaryCount; i++) {
//       const home = prelimTeams[i];
//       const away = prelimTeams[prelimTeams.length - 1 - i];

//       const slotIndex = order.indexOf(byeCount + 1 + i);

//       matches.push({
//         stage: preliminaryStage,
//         position: i + 1,
//         homeSource: this.fixedSlot(home.teamId),
//         awaySource: this.fixedSlot(away.teamId),
//         winnerFeedsToStage: firstFullStage,
//         winnerFeedsToPosition: Math.floor(slotIndex / 2) + 1,
//         winnerFeedsToSlot:
//           slotIndex % 2 === 0
//             ? KnockoutTargetSlot.HOME
//             : KnockoutTargetSlot.AWAY,
//       });

//       slots[slotIndex] = this.winnerSlot(i + 1);
//     }

//     matches.push(...this.buildFullStage(slots, firstFullStage));
//     this.connectFollowingRounds(matches, firstFullStage);

//     return {
//       matches,
//       bracketSize,
//       preliminaryMatches: preliminaryCount,
//       firstKnockoutStage: firstFullStage,
//       totalQualifiers: count,
//     };
//   }

//   private buildFullStage(
//     slots: TeamSlot[],
//     stage: FixtureStage,
//   ): BracketMatchDefinition[] {
//     if (slots.length < 2 || slots.length % 2 !== 0) {
//       throw new BadRequestException(`Invalid participant count for ${stage}.`);
//     }

//     const matches: BracketMatchDefinition[] = [];

//     for (let index = 0; index < slots.length / 2; index++) {
//       matches.push({
//         stage,
//         position: index + 1,
//         homeSource: slots[index * 2],
//         awaySource: slots[index * 2 + 1],
//         winnerFeedsToPosition: null,
//         winnerFeedsToStage: null,
//         winnerFeedsToSlot: null,
//         loserFeedsToPosition: null,
//         loserFeedsToStage: null,
//         loserFeedsToSlot: null,
//       });
//     }

//     return matches;
//   }

//   private connectFollowingRounds(
//     matches: BracketMatchDefinition[],
//     firstStage: FixtureStage,
//   ) {
//     let currentStage = firstStage;

//     while (true) {
//       const nextStage = this.getNextStage(currentStage);
//       if (!nextStage) break;

//       const currentMatches = matches
//         .filter((m) => m.stage === currentStage)
//         .sort((a, b) => a.position - b.position);

//       const nextMatchCount = currentMatches.length / 2;
//       if (nextMatchCount < 1) break;

//       for (let index = 0; index < nextMatchCount; index++) {
//         const nextPosition = index + 1;
//         const first = currentMatches[index * 2];
//         const second = currentMatches[index * 2 + 1];

//         first.winnerFeedsToStage = nextStage;
//         first.winnerFeedsToPosition = nextPosition;
//         first.winnerFeedsToSlot = KnockoutTargetSlot.HOME;

//         second.winnerFeedsToStage = nextStage;
//         second.winnerFeedsToPosition = nextPosition;
//         second.winnerFeedsToSlot = KnockoutTargetSlot.AWAY;

//         matches.push({
//           stage: nextStage,
//           position: nextPosition,
//           homeSource: this.winnerSlot(first.position),
//           awaySource: this.winnerSlot(second.position),
//           winnerFeedsToPosition: null,
//           winnerFeedsToStage: null,
//           winnerFeedsToSlot: null,
//           loserFeedsToPosition: null,
//           loserFeedsToStage: null,
//           loserFeedsToSlot: null,
//         });
//       }

//       currentStage = nextStage;
//     }
//   }

//   // =========================================================
//   // PERSIST BRACKET (shared by manual + generated)
//   // =========================================================

//   private async persistBracket(
//     tournamentId: string,
//     organizationId: string,
//     definitions: BracketMatchDefinition[],
//   ) {
//     const stages = Array.from(new Set(definitions.map((d) => d.stage))).sort(
//       (a, b) => this.getStageOrder(a) - this.getStageOrder(b),
//     );

//     // Stages: the earliest one is ACTIVE, the rest PENDING.
//     for (let index = 0; index < stages.length; index++) {
//       const stage = stages[index];

//       const existing = await this.stageRepo.findByStageForTenant(
//         tournamentId,
//         organizationId,
//         stage,
//       );
//       if (existing) continue;

//       await this.stageRepo.create({
//         organizationId: new Types.ObjectId(organizationId),
//         tournamentId: new Types.ObjectId(tournamentId),
//         stage,
//         order: this.getStageOrder(stage),
//         status:
//           index === 0
//             ? KnockoutStageStatus.ACTIVE
//             : KnockoutStageStatus.PENDING,
//       } as any);
//     }

//     // Matches.
//     const created: KnockoutMatchDocument[] = [];

//     for (const def of definitions) {
//       const match = await this.knockoutMatchRepo.create({
//         organizationId: new Types.ObjectId(organizationId),
//         tournamentId: new Types.ObjectId(tournamentId),
//         stage: def.stage,
//         position: def.position,
//         fixtureId: null,
//         homeSource: def.homeSource,
//         awaySource: def.awaySource,
//         winnerFeedsToPosition: def.winnerFeedsToPosition ?? null,
//         winnerFeedsToStage: def.winnerFeedsToStage ?? null,
//         winnerFeedsToSlot: def.winnerFeedsToSlot ?? null,
//         loserFeedsToPosition: def.loserFeedsToPosition ?? null,
//         loserFeedsToStage: def.loserFeedsToStage ?? null,
//         loserFeedsToSlot: def.loserFeedsToSlot ?? null,
//         status: this.canResolveFixture(def.homeSource, def.awaySource)
//           ? KnockoutMatchStatus.READY
//           : KnockoutMatchStatus.PENDING,
//       } as any);

//       created.push(match);
//     }

//     // Fixtures for matches whose two teams are already known.
//     for (const match of created) {
//       await this.tryResolveAndCreateFixture(
//         match._id.toString(),
//         organizationId,
//         tournamentId,
//       );
//     }

//     return created;
//   }

//   // =========================================================
//   // MATCH FINISHED
//   // =========================================================

//   async handleMatchFinished(payload: {
//     matchId: string;
//     fixtureId: string;
//     tournamentId: string;
//     organizationId: string;
//     homeTeamId: string;
//     awayTeamId: string;
//     result: MatchResult;
//   }) {
//     const { fixtureId, organizationId, tournamentId, result } = payload;

//     // A knockout match cannot advance on a draw.
//     if (result !== MatchResult.HOME_WIN && result !== MatchResult.AWAY_WIN) {
//       return;
//     }

//     // The event carries the real fixture id, so look the knockout match up
//     // by its fixture (NOT by the football match id).
//     const knockoutMatch = await this.knockoutMatchRepo.findByFixtureForTenant(
//       fixtureId,
//       organizationId,
//     );

//     if (!knockoutMatch) return;

//     // Idempotency: already processed.
//     if (knockoutMatch.status === KnockoutMatchStatus.COMPLETED) return;

//     const homeWon = result === MatchResult.HOME_WIN;
//     const winnerTeamId = homeWon ? payload.homeTeamId : payload.awayTeamId;
//     const loserTeamId = homeWon ? payload.awayTeamId : payload.homeTeamId;

//     // Winner routing.
//     if (knockoutMatch.winnerFeedsToStage && knockoutMatch.winnerFeedsToPosition) {
//       await this.resolveSlotInto(
//         tournamentId,
//         organizationId,
//         knockoutMatch.winnerFeedsToStage,
//         knockoutMatch.winnerFeedsToPosition,
//         knockoutMatch.winnerFeedsToSlot ?? KnockoutTargetSlot.HOME,
//         winnerTeamId,
//       );
//     }

//     // Loser routing (third-place / consolation brackets).
//     if (knockoutMatch.loserFeedsToStage && knockoutMatch.loserFeedsToPosition) {
//       await this.resolveSlotInto(
//         tournamentId,
//         organizationId,
//         knockoutMatch.loserFeedsToStage,
//         knockoutMatch.loserFeedsToPosition,
//         knockoutMatch.loserFeedsToSlot ?? KnockoutTargetSlot.HOME,
//         loserTeamId,
//       );
//     }

//     await this.knockoutMatchRepo.updateById(knockoutMatch._id.toString(), {
//       status: KnockoutMatchStatus.COMPLETED,
//     } as any);

//     await this.updateStageStatusAfterMatch(
//       tournamentId,
//       organizationId,
//       knockoutMatch.stage,
//     );
//   }

//   // =========================================================
//   // RESOLVE SLOT
//   // =========================================================

//   private async resolveSlotInto(
//     tournamentId: string,
//     organizationId: string,
//     stage: FixtureStage,
//     position: number,
//     targetSlot: KnockoutTargetSlot,
//     teamId: string,
//   ) {
//     const target = await this.knockoutMatchRepo.findByPositionForTenant(
//       tournamentId,
//       organizationId,
//       stage,
//       position,
//     );

//     if (!target) {
//       throw new NotFoundException(
//         `Knockout match ${stage} #${position} was not found.`,
//       );
//     }

//     const source = this.fixedSlot(teamId);
//     const isHome = targetSlot === KnockoutTargetSlot.HOME;

//     const homeSource = isHome ? source : target.homeSource;
//     const awaySource = isHome ? target.awaySource : source;

//     const updated = await this.knockoutMatchRepo.updateById(
//       target._id.toString(),
//       {
//         ...(isHome ? { homeSource: source } : { awaySource: source }),
//         status: this.canResolveFixture(homeSource, awaySource)
//           ? KnockoutMatchStatus.READY
//           : KnockoutMatchStatus.PENDING,
//       } as any,
//     );

//     if (!updated) {
//       throw new NotFoundException('Knockout match could not be updated.');
//     }

//     // Only create the fixture once both teams are known.
//     if (this.canResolveFixture(updated.homeSource, updated.awaySource)) {
//       await this.tryResolveAndCreateFixture(
//         updated._id.toString(),
//         organizationId,
//         tournamentId,
//       );
//     }
//   }

//   // =========================================================
//   // CREATE FIXTURE WHEN READY
//   // =========================================================

//   private async tryResolveAndCreateFixture(
//     knockoutMatchId: string,
//     organizationId: string,
//     tournamentId: string,
//   ) {
//     const knockoutMatch = await this.knockoutMatchRepo.findByIdForTenant(
//       knockoutMatchId,
//       organizationId,
//     );

//     if (!knockoutMatch) return null;
//     if (knockoutMatch.fixtureId) return knockoutMatch;

//     if (
//       !this.canResolveFixture(knockoutMatch.homeSource, knockoutMatch.awaySource)
//     ) {
//       return knockoutMatch;
//     }

//     const homeTeamId = knockoutMatch.homeSource.teamId;
//     const awayTeamId = knockoutMatch.awaySource.teamId;

//     if (!homeTeamId || !awayTeamId) return knockoutMatch;

//     const fixture = await this.fixturesService.create(
//       tournamentId,
//       organizationId,
//       {
//         stage: knockoutMatch.stage,
//         homeSlot: this.fixedSlot(homeTeamId.toString()) as any,
//         awaySlot: this.fixedSlot(awayTeamId.toString()) as any,
//         scheduledAt: new Date().toISOString(),
//       },
//     );

//     if (!fixture) return knockoutMatch;

//     const fixtureId = this.getId((fixture as any)._id ?? (fixture as any).id);

//     return this.knockoutMatchRepo.updateById(knockoutMatchId, {
//       fixtureId: new Types.ObjectId(fixtureId),
//       status: KnockoutMatchStatus.READY,
//     } as any);
//   }

//   // =========================================================
//   // STAGE STATUS
//   //
//   // The next stage is the next one that EXISTS for this
//   // tournament (by order), so preliminary -> semi_final works
//   // regardless of the opening stage.
//   // =========================================================

//   private async updateStageStatusAfterMatch(
//     tournamentId: string,
//     organizationId: string,
//     stage: FixtureStage,
//   ) {
//     const matches = await this.knockoutMatchRepo.findByStageForTenant(
//       tournamentId,
//       organizationId,
//       stage,
//     );

//     if (matches.length === 0) return;

//     const stageDoc = await this.stageRepo.findByStageForTenant(
//       tournamentId,
//       organizationId,
//       stage,
//     );

//     if (!stageDoc) return;

//     const allCompleted = matches.every(
//       (m) => m.status === KnockoutMatchStatus.COMPLETED,
//     );

//     await this.stageRepo.updateById(stageDoc._id.toString(), {
//       status: allCompleted
//         ? KnockoutStageStatus.COMPLETED
//         : KnockoutStageStatus.ACTIVE,
//     } as any);

//     if (!allCompleted) return;

//     const nextStageDoc = await this.stageRepo.findNextStageForTenant(
//       tournamentId,
//       organizationId,
//       stageDoc.order,
//     );

//     if (nextStageDoc && nextStageDoc.status === KnockoutStageStatus.PENDING) {
//       await this.stageRepo.updateById(nextStageDoc._id.toString(), {
//         status: KnockoutStageStatus.ACTIVE,
//       } as any);
//     }
//   }

//   // =========================================================
//   // SLOT HELPERS
//   // =========================================================

//   private fixedSlot(teamId: string): TeamSlot {
//     return {
//       type: TeamSlotType.FIXED,
//       teamId: new Types.ObjectId(teamId),
//       groupId: null,
//       position: null,
//       sourceFixtureId: null,
//     };
//   }

//   /** Placeholder for "winner of match #position in the feeding stage". */
//   private winnerSlot(position: number): TeamSlot {
//     return {
//       type: TeamSlotType.MATCH_WINNER,
//       teamId: null,
//       groupId: null,
//       position,
//       sourceFixtureId: null,
//     };
//   }

//   private toSchemaTeamSlot(source: any): TeamSlot {
//     return {
//       type: source.type,
//       teamId: source.teamId ? new Types.ObjectId(source.teamId) : null,
//       groupId: source.groupId ? new Types.ObjectId(source.groupId) : null,
//       position: source.position ?? null,
//       sourceFixtureId: source.sourceFixtureId
//         ? new Types.ObjectId(source.sourceFixtureId)
//         : null,
//     };
//   }

//   private canResolveFixture(homeSource: TeamSlot, awaySource: TeamSlot): boolean {
//     return (
//       homeSource.type === TeamSlotType.FIXED &&
//       awaySource.type === TeamSlotType.FIXED &&
//       !!homeSource.teamId &&
//       !!awaySource.teamId
//     );
//   }

//   // =========================================================
//   // QUALIFIER HELPERS
//   // =========================================================

//   private uniqueQualifiedTeams(teams: QualifiedTeam[]): QualifiedTeam[] {
//     const seen = new Set<string>();
//     const result: QualifiedTeam[] = [];

//     for (const team of teams) {
//       if (!team.teamId || seen.has(team.teamId)) continue;
//       seen.add(team.teamId);
//       result.push(team);
//     }

//     return result;
//   }

//   private getStandingRankingFields(row: any) {
//     return {
//       points: row.points ?? 0,
//       goalDifference: row.goalDifference ?? 0,
//       goalsFor: row.goalsFor ?? 0,
//       wins: row.wins ?? 0,
//       played: row.played ?? 0,
//     };
//   }

//   private compareStandingRows(a: any, b: any): number {
//     const pointsDiff = (b.points ?? 0) - (a.points ?? 0);
//     if (pointsDiff !== 0) return pointsDiff;

//     const gdDiff = (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
//     if (gdDiff !== 0) return gdDiff;

//     const gfDiff = (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
//     if (gfDiff !== 0) return gfDiff;

//     const winsDiff = (b.wins ?? 0) - (a.wins ?? 0);
//     if (winsDiff !== 0) return winsDiff;

//     return (
//       (a.groupPosition ?? Number.MAX_SAFE_INTEGER) -
//       (b.groupPosition ?? Number.MAX_SAFE_INTEGER)
//     );
//   }

//   // =========================================================
//   // STAGE HELPERS
//   // =========================================================

//   private normalizeStage(stage: string): string {
//     const normalized = String(stage ?? '')
//       .trim()
//       .toLowerCase()
//       .replace(/[ -]/g, '_');

//     if (
//       normalized === 'round_of_8' ||
//       normalized === 'quarterfinal' ||
//       normalized === 'quarter_finals' ||
//       normalized === 'quarterfinals'
//     ) {
//       return 'quarter_final';
//     }

//     if (
//       normalized === 'semifinal' ||
//       normalized === 'semi_finals' ||
//       normalized === 'semifinals'
//     ) {
//       return 'semi_final';
//     }

//     if (normalized === 'prelim' || normalized === 'preliminary_round') {
//       return 'preliminary';
//     }

//     return normalized;
//   }

//   private getStageForTeamCount(participantCount: number): FixtureStage {
//     const entry = Object.entries(STAGE_CAPACITY).find(
//       ([, capacity]) => capacity === participantCount,
//     );

//     if (!entry) {
//       throw new BadRequestException(
//         `Unsupported knockout stage size: ${participantCount} teams.`,
//       );
//     }

//     return entry[0] as FixtureStage;
//   }

//   private getNextStage(stage: FixtureStage): FixtureStage | null {
//     return (NEXT_STAGE[this.normalizeStage(stage)] as FixtureStage) ?? null;
//   }

//   private getStageOrder(stage: FixtureStage | string): number {
//     return STAGE_ORDER[this.normalizeStage(stage)] ?? 99;
//   }

//   // =========================================================
//   // VALIDATION
//   // =========================================================

//   private async assertNoExistingBracket(
//     tournamentId: string,
//     organizationId: string,
//   ) {
//     const existing = await this.knockoutMatchRepo.findByTournamentForTenant(
//       tournamentId,
//       organizationId,
//     );

//     if (existing.length > 0) {
//       throw new BadRequestException(
//         'A knockout bracket already exists for this tournament.',
//       );
//     }
//   }

//   private validateBracketDefinition(
//     matches: Array<{
//       stage: string;
//       position: number;
//       homeSource: any;
//       awaySource: any;
//     }>,
//   ) {
//     const seen = new Set<string>();

//     for (const match of matches) {
//       if (!match.stage) {
//         throw new BadRequestException('Every knockout match requires a stage.');
//       }

//       if (!Number.isInteger(match.position) || match.position <= 0) {
//         throw new BadRequestException(
//           'Knockout match positions must be positive integers.',
//         );
//       }

//       const key = `${match.stage}:${match.position}`;

//       if (seen.has(key)) {
//         throw new BadRequestException(
//           `Duplicate knockout match position: ${key}.`,
//         );
//       }

//       seen.add(key);

//       this.validateTeamSlot(match.homeSource, 'homeSource');
//       this.validateTeamSlot(match.awaySource, 'awaySource');
//     }
//   }

//   private validateTeamSlot(source: any, field: string) {
//     if (!source || !source.type) {
//       throw new BadRequestException(`${field}.type is required.`);
//     }

//     if (source.type === TeamSlotType.FIXED && !source.teamId) {
//       throw new BadRequestException(
//         `${field}.teamId is required for a fixed team slot.`,
//       );
//     }

//     if (
//       source.type === TeamSlotType.GROUP_POSITION &&
//       (!source.groupId || !source.position)
//     ) {
//       throw new BadRequestException(
//         `${field} requires groupId and position for group-position slots.`,
//       );
//     }

//     if (
//       (source.type === TeamSlotType.MATCH_WINNER ||
//         source.type === TeamSlotType.MATCH_LOSER) &&
//       !source.position
//     ) {
//       throw new BadRequestException(
//         `${field}.position is required for match-winner / match-loser slots.`,
//       );
//     }
//   }

//   // =========================================================
//   // MISC
//   // =========================================================

//   private nextPowerOfTwo(value: number): number {
//     let result = 1;
//     while (result < value) result *= 2;
//     return result;
//   }

//   private getId(value: any): string {
//     if (value === undefined || value === null) {
//       throw new BadRequestException('A required MongoDB identifier is missing.');
//     }
//     return value.toString();
//   }
// }




// import {
//   BadRequestException,
//   Inject,
//   Injectable,
//   Logger,
//   NotFoundException,
// } from '@nestjs/common';

// import { EventEmitter2 } from '@nestjs/event-emitter';

// import {
//   Types,
// } from 'mongoose';

// import {
//   IKnockoutStageRepository,
//   IKnockoutMatchRepository,
//   KNOCKOUT_STAGE_REPOSITORY,
//   KNOCKOUT_MATCH_REPOSITORY,
// } from './interfaces/knockout-repository.interface';

// import {
//   KnockoutMatchStatus,
//   KnockoutTargetSlot,
//   KnockoutMatchDocument,
// } from './schemas/knockout-match.schema';

// import {
//   KnockoutStageStatus,
// } from './schemas/knockout-stage.schema';

// import {
//   CreateKnockoutBracketDto,
// } from './dto/create-knockout-bracket.dto';

// import {
//   GenerateBracketDto,
// } from './dto/generate-bracket.dto';

// import {
//   FixturesService,
// } from '../fixtures/fixtures.service';

// import {
//   FixtureStage,
//   TeamSlot,
//   TeamSlotType,
// } from '../fixtures/schemas/fixture.schema';

// import {
//   GroupsService,
// } from '../groups/groups.service';

// import {
//   StandingsService,
//   StandingRow,
// } from '../standings/standings.service';

// import {
//   TeamsService,
// } from '../teams/teams.service';

// import {
//   MatchResult,
// } from '../matches/schemas/match.schema';


// // =========================================================
// // INTERNAL TYPES
// // =========================================================

// interface QualifiedTeam {
//   teamId: string;
//   groupId?: string;
//   groupPosition?: number;
//   teamName?: string;
//   seed?: number;
// }

// interface GroupStandingBucket {
//   group: any;
//   standings: StandingRow[];
// }

// interface BracketMatchDefinition {
//   stage: FixtureStage;
//   position: number;

//   homeSource: TeamSlot;
//   awaySource: TeamSlot;

//   winnerFeedsToPosition?: number | null;
//   winnerFeedsToStage?: FixtureStage | null;
//   winnerFeedsToSlot?: KnockoutTargetSlot | null;

//   loserFeedsToPosition?: number | null;
//   loserFeedsToStage?: FixtureStage | null;
//   loserFeedsToSlot?: KnockoutTargetSlot | null;
// }

// interface BracketGenerationResult {
//   matches: BracketMatchDefinition[];

//   bracketSize: number;

//   preliminaryMatches: number;

//   firstKnockoutStage: FixtureStage;

//   totalQualifiers: number;

//   automaticQualifiers: number;

//   bestThirdPlaceQualifiers: number;
// }


// // =========================================================
// // SERVICE
// // =========================================================

// @Injectable()
// export class KnockoutService {
//   private readonly logger =
//     new Logger(KnockoutService.name);

//   constructor(
//     @Inject(KNOCKOUT_STAGE_REPOSITORY)
//     private readonly stageRepo: IKnockoutStageRepository,

//     @Inject(KNOCKOUT_MATCH_REPOSITORY)
//     private readonly knockoutMatchRepo: IKnockoutMatchRepository,

//     private readonly fixturesService: FixturesService,

//     private readonly groupsService: GroupsService,

//     private readonly standingsService: StandingsService,

//     private readonly teamsService: TeamsService,

//     private readonly eventEmitter: EventEmitter2,
//   ) {}

//   // =========================================================
//   // PUBLIC: LIST BRACKET
//   // =========================================================

//   async listForTournament(
//     tournamentId: string,
//     organizationId: string,
//   ) {
//     const matches =
//       await this.knockoutMatchRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         );

//     return matches.sort(
//       (a, b) => {
//         const stageOrderA =
//           this.getStageOrder(
//             a.stage,
//           );

//         const stageOrderB =
//           this.getStageOrder(
//             b.stage,
//           );

//         if (
//           stageOrderA !== stageOrderB
//         ) {
//           return (
//             stageOrderA -
//             stageOrderB
//           );
//         }

//         return (
//           a.position -
//           b.position
//         );
//       },
//     );
//   }

//   // =========================================================
//   // PUBLIC: CREATE MANUAL BRACKET
//   // =========================================================

//   async createBracket(
//     tournamentId: string,
//     organizationId: string,
//     dto: CreateKnockoutBracketDto,
//   ) {
//     if (
//       !dto.matches ||
//       dto.matches.length === 0
//     ) {
//       throw new BadRequestException(
//         'At least one knockout match is required.',
//       );
//     }

//     const existing =
//       await this.knockoutMatchRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         );

//     if (existing.length > 0) {
//       throw new BadRequestException(
//         'A knockout bracket already exists for this tournament.',
//       );
//     }

//     this.validateBracketDefinition(
//       dto.matches,
//     );

//     const stageNames =
//       Array.from(
//         new Set(
//           dto.matches.map(
//             (match) =>
//               this.normalizeStage(
//                 match.stage,
//               ),
//           ),
//         ),
//       );

//     for (
//       let index = 0;
//       index < stageNames.length;
//       index++
//     ) {
//       const stage =
//         stageNames[index];

//       const existingStage =
//         await this.stageRepo
//           .findByStageForTenant(
//             tournamentId,
//             organizationId,
//             stage,
//           );

//       if (existingStage) {
//         continue;
//       }

//       await this.stageRepo.create({
//         organizationId:
//           new Types.ObjectId(
//             organizationId,
//           ),

//         tournamentId:
//           new Types.ObjectId(
//             tournamentId,
//           ),

//         stage:
//           stage as FixtureStage,

//         order:
//           this.getStageOrder(
//             stage as FixtureStage,
//           ),

//         status:
//           index === 0
//             ? KnockoutStageStatus.ACTIVE
//             : KnockoutStageStatus.PENDING,
//       } as any);
//     }

//     const created: KnockoutMatchDocument[] =
//       [];

//     for (
//       const input of dto.matches
//     ) {
//       const homeSource =
//         this.toSchemaTeamSlot(
//           input.homeSource,
//         );

//       const awaySource =
//         this.toSchemaTeamSlot(
//           input.awaySource,
//         );

//       const status =
//         this.canResolveFixture(
//           homeSource,
//           awaySource,
//         )
//           ? KnockoutMatchStatus.READY
//           : KnockoutMatchStatus.PENDING;

//       const match =
//         await this.knockoutMatchRepo.create({
//           organizationId:
//             new Types.ObjectId(
//               organizationId,
//             ),

//           tournamentId:
//             new Types.ObjectId(
//               tournamentId,
//             ),

//           stage:
//             input.stage,

//           position:
//             input.position,

//           fixtureId:
//             null,

//           homeSource,

//           awaySource,

//           winnerFeedsToPosition:
//             input.winnerFeedsToPosition ??
//             null,

//           winnerFeedsToStage:
//             input.winnerFeedsToStage ??
//             null,

//           winnerFeedsToSlot:
//             input.winnerFeedsToSlot ??
//             null,

//           loserFeedsToPosition:
//             input.loserFeedsToPosition ??
//             null,

//           loserFeedsToStage:
//             input.loserFeedsToStage ??
//             null,

//           loserFeedsToSlot:
//             input.loserFeedsToSlot ??
//             null,

//           status,
//         } as any);

//       created.push(match);
//     }

//     // -------------------------------------------------------
//     // Resolve immediately-resolvable fixtures.
//     // -------------------------------------------------------

//     for (
//       const match of created
//     ) {
//       await this.tryResolveAndCreateFixture(
//         match._id.toString(),
//         organizationId,
//         tournamentId,
//       );
//     }

//     return this.listForTournament(
//       tournamentId,
//       organizationId,
//     );
//   }

//   // =========================================================
//   // PUBLIC: GENERATE FROM STANDINGS
//   // =========================================================

//   async generateFromStandings(
//     tournamentId: string,
//     organizationId: string,
//     requestedStage: string,
//     dto: GenerateBracketDto,
//   ) {
//     const existing =
//       await this.knockoutMatchRepo
//         .findByTournamentForTenant(
//           tournamentId,
//           organizationId,
//         );

//     if (existing.length > 0) {
//       throw new BadRequestException(
//         'A knockout bracket already exists for this tournament.',
//       );
//     }

//     // -------------------------------------------------------
//     // Get registered teams.
//     //
//     // This is intentionally tournament-scoped.
//     // -------------------------------------------------------

//     const registeredTeams =
//       await this.teamsService
//         .listForTournament(
//           organizationId,
//           tournamentId,
//         );

//     const registeredTeamIds =
//       registeredTeams.map(
//         (team: any) =>
//           this.getId(
//             team._id ??
//               team.id,
//           ),
//       );

//     if (
//       registeredTeamIds.length === 0
//     ) {
//       throw new BadRequestException(
//         'Knockout generation requires at least 2 registered teams. Got 0.',
//       );
//     }

//     if (
//       registeredTeamIds.length < 2
//     ) {
//       throw new BadRequestException(
//         `Knockout generation requires at least 2 registered teams. Got ${registeredTeamIds.length}.`,
//       );
//     }

//     // -------------------------------------------------------
//     // Load groups.
//     //
//     // Knockout-only tournaments do not require groups.
//     // -------------------------------------------------------

//     const groups =
//       await this.groupsService.listForTournament(
//         organizationId,
//         tournamentId,
//       );

//     let qualifiedTeams: QualifiedTeam[] =
//       [];

//     let automaticQualifiers = 0;

//     let bestThirdPlaceQualifiers = 0;

//     // =======================================================
//     // GROUP + STANDINGS MODE
//     // =======================================================

//     if (
//       groups &&
//       groups.length > 0
//     ) {
//       const standingsByGroup:
//         GroupStandingBucket[] =
//         [];

//       for (
//         const group of groups
//       ) {
//         const groupId =
//           this.getId(
//             group._id ??
//               group.id,
//           );

//         const standings =
//           await this.standingsService
//             .calculate(
//               organizationId,
//               tournamentId,
//               groupId,
//             );

//         standingsByGroup.push({
//           group,
//           standings:
//             standings.filter(
//               (row: any) =>
//                 registeredTeamIds.includes(
//                   this.getId(
//                     row.teamId,
//                   ),
//                 ),
//             ),
//         });
//       }

//       const qualification =
//         this.calculateQualifiers(
//           standingsByGroup,
//           dto,
//         );

//       qualifiedTeams =
//         qualification.qualified;

//       automaticQualifiers =
//         qualification.automaticQualifiers;

//       bestThirdPlaceQualifiers =
//         qualification.bestThirdPlaceQualifiers;
//     }

//     // =======================================================
//     // KNOCKOUT-ONLY MODE
//     // =======================================================

//     if (
//       qualifiedTeams.length === 0 &&
//       (!groups ||
//         groups.length === 0)
//     ) {
//       qualifiedTeams =
//         registeredTeams.map(
//           (team: any) => ({
//             teamId:
//               this.getId(
//                 team._id ??
//                   team.id,
//               ),

//             teamName:
//               team.name ??
//               team.teamName ??
//               undefined,
//           }),
//         );
//     }

//     // -------------------------------------------------------
//     // Remove duplicate team IDs.
//     // -------------------------------------------------------

//     qualifiedTeams =
//       this.uniqueQualifiedTeams(
//         qualifiedTeams,
//       );

//     if (
//       qualifiedTeams.length < 2
//     ) {
//       throw new BadRequestException(
//         `Knockout generation requires at least 2 qualified teams. Got ${qualifiedTeams.length}.`,
//       );
//     }

//     // -------------------------------------------------------
//     // Make sure every qualifier is registered.
//     // -------------------------------------------------------

//     const registeredSet =
//       new Set(
//         registeredTeamIds,
//       );

//     qualifiedTeams =
//       qualifiedTeams.filter(
//         (team) =>
//           registeredSet.has(
//             team.teamId,
//           ),
//       );

//     if (
//       qualifiedTeams.length < 2
//     ) {
//       throw new BadRequestException(
//         'No valid registered teams remain after qualification.',
//       );
//     }

//     // -------------------------------------------------------
//     // Seed.
//     // -------------------------------------------------------

//     const seeded =
//       this.seedQualifiers(
//         qualifiedTeams,
//       );

//     // -------------------------------------------------------
//     // Build generic bracket.
//     // -------------------------------------------------------

//     const bracket =
//       this.buildGenericBracket(
//         seeded,
//       );

//     // -------------------------------------------------------
//     // Validate an explicitly requested opening stage against
//     // the stage inferred from the qualified team count.
//     // -------------------------------------------------------

//     const normalizedRequested =
//       requestedStage
//         ? this.normalizeStage(
//             requestedStage,
//           )
//         : null;

//     if (normalizedRequested) {
//       if (
//         !this.isKnownKnockoutStage(
//           normalizedRequested,
//         )
//       ) {
//         throw new BadRequestException(
//           `Unknown knockout stage "${requestedStage}". Choose preliminary, round_of_64, round_of_32, round_of_16, quarter_final, semi_final, or final.`,
//         );
//       }

//       const generatedOpeningStage =
//         bracket.matches[0]?.stage ??
//         bracket.firstKnockoutStage;

//       if (
//         normalizedRequested !==
//         generatedOpeningStage
//       ) {
//         throw new BadRequestException(
//           `${seeded.length} qualified teams start at ${generatedOpeningStage}, not ${normalizedRequested}. A quarter-final requires 8 teams; 2 teams play the final.`,
//         );
//       }

//       this.logger.debug(
//         `Requested knockout stage "${normalizedRequested}" matches the generated bracket for ${seeded.length} qualifiers.`,
//       );
//     }

//     // -------------------------------------------------------
//     // Create bracket.
//     // -------------------------------------------------------

//     await this.createGeneratedBracket(
//       tournamentId,
//       organizationId,
//       bracket.matches,
//     );

//     return {
//       success: true,

//       tournamentId,

//       totalTeams:
//         registeredTeamIds.length,

//       totalGroups:
//         groups?.length ?? 0,

//       automaticQualifiers,

//       bestThirdPlaceQualifiers,

//       totalKnockoutQualifiers:
//         bracket.totalQualifiers,

//       bracketSize:
//         bracket.bracketSize,

//       preliminaryMatches:
//         bracket.preliminaryMatches,

//       hasByes:
//         bracket.bracketSize >
//         bracket.totalQualifiers,

//       firstKnockoutStage:
//         bracket.firstKnockoutStage,

//       matchesCreated:
//         bracket.matches.length,
//     };
//   }

//   // =========================================================
//   // QUALIFICATION ENGINE
//   // =========================================================

//   private calculateQualifiers(
//     standingsByGroup:
//       GroupStandingBucket[],
//     dto: GenerateBracketDto,
//   ) {
//     const qualified: QualifiedTeam[] =
//       [];

//     const additionalCandidates:
//       QualifiedTeam[] =
//       [];

//     let automaticQualifiers = 0;

//     let bestThirdPlaceQualifiers = 0;

//     const explicitRules =
//       dto.groupRules ?? [];

//     for (
//       let groupIndex = 0;
//       groupIndex <
//       standingsByGroup.length;
//       groupIndex++
//     ) {
//       const bucket =
//         standingsByGroup[
//           groupIndex
//         ];

//       const standings =
//         bucket.standings ?? [];

//       const groupId =
//         this.getId(
//           bucket.group._id ??
//             bucket.group.id,
//         );

//       const rule =
//         explicitRules[
//           groupIndex
//         ];

//       const teamsPerGroup =
//         rule?.teamsPerGroup ??
//         dto.teamsPerGroup ??
//         2;

//       if (
//         teamsPerGroup < 0
//       ) {
//         throw new BadRequestException(
//           'teamsPerGroup cannot be negative.',
//         );
//       }

//       const selected =
//         standings.slice(
//           0,
//           teamsPerGroup,
//         );

//       for (
//         let position = 0;
//         position <
//         selected.length;
//         position++
//       ) {
//         const row: any =
//           selected[position];

//         qualified.push({
//           teamId:
//             this.getId(
//               row.teamId,
//             ),

//           groupId,

//           groupPosition:
//             row.groupPosition ??
//             position + 1,

//           teamName:
//             row.teamName ??
//             row.name ??
//             undefined,
//         });

//         automaticQualifiers++;
//       }

//       // -----------------------------------------------------
//       // Remaining teams become candidates for additional
//       // cross-group qualification.
//       // -----------------------------------------------------

//       const remaining =
//         standings.slice(
//           teamsPerGroup,
//         );

//       for (
//         let position = 0;
//         position <
//         remaining.length;
//         position++
//       ) {
//         const row: any =
//           remaining[position];

//         additionalCandidates.push({
//           teamId:
//             this.getId(
//               row.teamId,
//             ),

//           groupId,

//           groupPosition:
//             row.groupPosition ??
//             teamsPerGroup +
//               position +
//               1,

//           teamName:
//             row.teamName ??
//             row.name ??
//             undefined,

//           ...this.getStandingRankingFields(
//             row,
//           ),
//         } as any);
//       }

//       // -----------------------------------------------------
//       // Legacy best-third-place mode.
//       //
//       // Only applies when no explicit additional count
//       // was supplied.
//       // -----------------------------------------------------

//       if (
//         dto.bestThirdPlaced ===
//           true &&
//         dto.additionalBestTeams ===
//           undefined &&
//         explicitRules.length ===
//           0
//       ) {
//         // Candidates are sorted globally below.
//       }
//     }

//     // =======================================================
//     // ADDITIONAL BEST TEAMS
//     // =======================================================

//     let additionalCount =
//       dto.additionalBestTeams;

//     if (
//       additionalCount ===
//       undefined
//     ) {
//       additionalCount =
//         explicitRules.reduce(
//           (
//             total,
//             rule,
//           ) =>
//             total +
//             (rule.additionalBestTeams ??
//               0),
//           0,
//         );
//     }

//     // -------------------------------------------------------
//     // Legacy bestThirdPlaced.
//     //
//     // Preserve compatibility by selecting one third-place
//     // team per eligible tournament when explicitly enabled.
//     // -------------------------------------------------------

//     if (
//       dto.bestThirdPlaced ===
//         true &&
//       additionalCount === 0
//     ) {
//       additionalCount = 1;
//     }

//     additionalCount =
//       Math.max(
//         0,
//         additionalCount ?? 0,
//       );

//     if (
//       additionalCount >
//       additionalCandidates.length
//     ) {
//       throw new BadRequestException(
//         `Requested ${additionalCount} additional qualifiers, but only ${additionalCandidates.length} eligible teams remain.`,
//       );
//     }

//     const sortedAdditional =
//       [...additionalCandidates]
//         .sort(
//           (
//             a: any,
//             b: any,
//           ) =>
//             this.compareStandingRows(
//               a,
//               b,
//             ),
//         );

//     const selectedAdditional =
//       sortedAdditional.slice(
//         0,
//         additionalCount,
//       );

//     for (
//       const team of selectedAdditional
//     ) {
//       qualified.push({
//         teamId:
//           team.teamId,

//         groupId:
//           team.groupId,

//         groupPosition:
//           team.groupPosition,

//         teamName:
//           team.teamName,
//       });

//       if (
//         dto.bestThirdPlaced ===
//           true &&
//         team.groupPosition ===
//           3
//       ) {
//         bestThirdPlaceQualifiers++;
//       } else {
//         bestThirdPlaceQualifiers++;
//       }
//     }

//     return {
//       qualified,

//       automaticQualifiers,

//       bestThirdPlaceQualifiers,
//     };
//   }

//   // =========================================================
//   // SEED QUALIFIERS
//   // =========================================================

//   private seedQualifiers(
//     qualifiers: QualifiedTeam[],
//   ): QualifiedTeam[] {
//     const sorted =
//       [...qualifiers].sort(
//         (
//           a,
//           b,
//         ) => {
//           const groupA =
//             a.groupId ?? '';

//           const groupB =
//             b.groupId ?? '';

//           if (
//             groupA !== groupB
//           ) {
//             return groupA.localeCompare(
//               groupB,
//             );
//           }

//           return (
//             (a.groupPosition ??
//               Number.MAX_SAFE_INTEGER) -
//             (b.groupPosition ??
//               Number.MAX_SAFE_INTEGER)
//           );
//         },
//       );

//     return sorted.map(
//       (
//         team,
//         index,
//       ) => ({
//         ...team,

//         seed:
//           index + 1,
//       }),
//     );
//   }

//   // =========================================================
//   // GENERIC BRACKET ENGINE
//   // =========================================================

//   private buildGenericBracket(
//     qualifiers: QualifiedTeam[],
//   ): BracketGenerationResult {
//     const count =
//       qualifiers.length;

//     if (count < 2) {
//       throw new BadRequestException(
//         'At least 2 qualifiers are required to generate a knockout bracket.',
//       );
//     }

//     const bracketSize =
//       this.nextPowerOfTwo(
//         count,
//       );

//     // -------------------------------------------------------
//     // Power-of-two bracket.
//     //
//     // 2  -> FINAL
//     // 4  -> SEMI_FINAL
//     // 8  -> QUARTER_FINAL
//     // 16 -> ROUND_OF_16
//     // 32 -> ROUND_OF_32
//     // 64 -> ROUND_OF_64
//     // -------------------------------------------------------

//     if (
//       bracketSize === count
//     ) {
//       const firstStage =
//         this.getStageForTeamCount(
//           count,
//         );

//       const matches =
//         this.buildFullStage(
//           qualifiers.map(
//             (team) =>
//               this.fixedSlot(
//                 team.teamId,
//               ),
//           ),
//           firstStage,
//         );

//       this.connectFollowingRounds(
//         matches,
//         firstStage,
//       );

//       return {
//         matches,

//         bracketSize,

//         preliminaryMatches: 0,

//         firstKnockoutStage:
//           firstStage,

//         totalQualifiers:
//           count,

//         automaticQualifiers:
//           0,

//         bestThirdPlaceQualifiers:
//           0,
//       };
//     }

//     // -------------------------------------------------------
//     // Non-power-of-two bracket.
//     //
//     // Example:
//     //
//     // 6 teams
//     // bracket = 8
//     // first full stage = 4 participants
//     // preliminary matches = 2
//     // byes = 2
//     //
//     // 12 teams
//     // bracket = 16
//     // first full stage = 8 participants
//     // preliminary matches = 4
//     // byes = 4
//     // -------------------------------------------------------

//     const firstFullParticipants =
//       bracketSize / 2;

//     const preliminaryMatches =
//       count -
//       firstFullParticipants;

//     const byeCount =
//       bracketSize -
//       count;

//     const preliminaryStage =
//       'preliminary' as FixtureStage;

//     const firstFullStage =
//       this.getStageForTeamCount(
//         firstFullParticipants,
//       );

//     const matches:
//       BracketMatchDefinition[] =
//       [];

//     // -------------------------------------------------------
//     // Preliminary matches.
//     // -------------------------------------------------------

//     const preliminaryWinners:
//       TeamSlot[] =
//       [];

//     let qualifierIndex =
//       byeCount;

//     for (
//       let index = 0;
//       index <
//       preliminaryMatches;
//       index++
//     ) {
//       const home =
//         qualifiers[
//           qualifierIndex++
//         ];

//       const away =
//         qualifiers[
//           qualifierIndex++
//         ];

//       if (
//         !home ||
//         !away
//       ) {
//         throw new BadRequestException(
//           'Unable to build preliminary knockout matches from the available qualifiers.',
//         );
//       }

//       const position =
//         index + 1;

//       matches.push({
//         stage:
//           preliminaryStage,

//         position,

//         homeSource:
//           this.fixedSlot(
//             home.teamId,
//           ),

//         awaySource:
//           this.fixedSlot(
//             away.teamId,
//           ),

//         winnerFeedsToStage:
//           firstFullStage,

//         winnerFeedsToPosition:
//           Math.floor(
//             index / 2,
//           ) + 1,

//         winnerFeedsToSlot:
//           index % 2 === 0
//             ? KnockoutTargetSlot.HOME
//             : KnockoutTargetSlot.AWAY,
//       });

//       preliminaryWinners.push(
//         this.winnerSlot(
//           preliminaryStage,
//           position,
//         ),
//       );
//     }

//     // -------------------------------------------------------
//     // Build slots for first full stage.
//     //
//     // Preliminary winners are distributed across the
//     // first-stage matches, while the highest seeds receive
//     // the byes.
//     // -------------------------------------------------------

//     const fullStageSlots:
//       Array<TeamSlot> =
//       new Array(
//         firstFullParticipants,
//       );

//     // Put preliminary winners into alternating slots.
//     for (
//       let index = 0;
//       index <
//       preliminaryWinners.length;
//       index++
//     ) {
//       const slotIndex =
//         index * 2 + 1;

//       if (
//         slotIndex <
//         fullStageSlots.length
//       ) {
//         fullStageSlots[
//           slotIndex
//         ] =
//           preliminaryWinners[
//             index
//           ];
//       }
//     }

//     // Fill all remaining slots with bye teams.
//     let byeTeamIndex = 0;

//     for (
//       let index = 0;
//       index <
//       fullStageSlots.length;
//       index++
//     ) {
//       if (
//         fullStageSlots[index]
//       ) {
//         continue;
//       }

//       const byeTeam =
//         qualifiers[
//           byeTeamIndex
//         ];

//       if (!byeTeam) {
//         throw new BadRequestException(
//           'Unable to allocate knockout byes.',
//         );
//       }

//       fullStageSlots[index] =
//         this.fixedSlot(
//           byeTeam.teamId,
//         );

//       byeTeamIndex++;
//     }

//     const firstStageMatches =
//       this.buildFullStage(
//         fullStageSlots,
//         firstFullStage,
//       );

//     matches.push(
//       ...firstStageMatches,
//     );

//     this.connectFollowingRounds(
//       matches,
//       firstFullStage,
//     );

//     return {
//       matches,

//       bracketSize,

//       preliminaryMatches,

//       firstKnockoutStage:
//         firstFullStage,

//       totalQualifiers:
//         count,

//       automaticQualifiers:
//         0,

//       bestThirdPlaceQualifiers:
//         0,
//     };
//   }

//   // =========================================================
//   // BUILD FULL STAGE
//   // =========================================================

//   private buildFullStage(
//     slots: TeamSlot[],
//     stage: FixtureStage,
//   ): BracketMatchDefinition[] {
//     if (
//       slots.length < 2 ||
//       slots.length % 2 !== 0
//     ) {
//       throw new BadRequestException(
//         `Invalid participant count for ${stage}.`,
//       );
//     }

//     const matches:
//       BracketMatchDefinition[] =
//       [];

//     const matchCount =
//       slots.length / 2;

//     for (
//       let index = 0;
//       index < matchCount;
//       index++
//     ) {
//       const home =
//         slots[index * 2];

//       const away =
//         slots[
//           index * 2 + 1
//         ];

//       matches.push({
//         stage,

//         position:
//           index + 1,

//         homeSource:
//           home,

//         awaySource:
//           away,

//         winnerFeedsToPosition:
//           null,

//         winnerFeedsToStage:
//           null,

//         winnerFeedsToSlot:
//           null,

//         loserFeedsToPosition:
//           null,

//         loserFeedsToStage:
//           null,

//         loserFeedsToSlot:
//           null,
//       });
//     }

//     return matches;
//   }

//   // =========================================================
//   // CONNECT FOLLOWING ROUNDS
//   // =========================================================

//   private connectFollowingRounds(
//     matches:
//       BracketMatchDefinition[],
//     firstStage: FixtureStage,
//   ) {
//     let currentStage =
//       firstStage;

//     while (true) {
//       const nextStage =
//         this.getNextStage(
//           currentStage,
//         );

//       if (!nextStage) {
//         break;
//       }

//       const currentMatches =
//         matches
//           .filter(
//             (match) =>
//               match.stage ===
//               currentStage,
//           )
//           .sort(
//             (a, b) =>
//               a.position -
//               b.position,
//           );

//       const nextMatchCount =
//         currentMatches.length /
//         2;

//       if (
//         nextMatchCount < 1
//       ) {
//         break;
//       }

//       for (
//         let index = 0;
//         index <
//         nextMatchCount;
//         index++
//       ) {
//         const nextPosition =
//           index + 1;

//         const firstSource =
//           currentMatches[
//             index * 2
//           ];

//         const secondSource =
//           currentMatches[
//             index * 2 + 1
//           ];

//         if (
//           firstSource
//         ) {
//           firstSource.winnerFeedsToStage =
//             nextStage;

//           firstSource.winnerFeedsToPosition =
//             nextPosition;

//           firstSource.winnerFeedsToSlot =
//             KnockoutTargetSlot.HOME;
//         }

//         if (
//           secondSource
//         ) {
//           secondSource.winnerFeedsToStage =
//             nextStage;

//           secondSource.winnerFeedsToPosition =
//             nextPosition;

//           secondSource.winnerFeedsToSlot =
//             KnockoutTargetSlot.AWAY;
//         }

//         matches.push({
//           stage:
//             nextStage,

//           position:
//             nextPosition,

//           homeSource:
//             this.winnerSlot(
//               currentStage,
//               firstSource.position,
//             ),

//           awaySource:
//             this.winnerSlot(
//               currentStage,
//               secondSource.position,
//             ),

//           winnerFeedsToPosition:
//             null,

//           winnerFeedsToStage:
//             null,

//           winnerFeedsToSlot:
//             null,

//           loserFeedsToPosition:
//             null,

//           loserFeedsToStage:
//             null,

//           loserFeedsToSlot:
//             null,
//         });
//       }

//       currentStage =
//         nextStage;
//     }
//   }

//   // =========================================================
//   // CREATE GENERATED BRACKET
//   // =========================================================

//   private async createGeneratedBracket(
//     tournamentId: string,
//     organizationId: string,
//     definitions:
//       BracketMatchDefinition[],
//   ) {
//     const stages =
//       Array.from(
//         new Set(
//           definitions.map(
//             (match) =>
//               match.stage,
//           ),
//         ),
//       ).sort(
//         (a, b) =>
//           this.getStageOrder(
//             a,
//           ) -
//           this.getStageOrder(
//             b,
//           ),
//       );

//     // -------------------------------------------------------
//     // Create stages.
//     // -------------------------------------------------------

//     for (
//       let index = 0;
//       index < stages.length;
//       index++
//     ) {
//       const stage =
//         stages[index];

//       const existing =
//         await this.stageRepo
//           .findByStageForTenant(
//             tournamentId,
//             organizationId,
//             stage,
//           );

//       if (existing) {
//         continue;
//       }

//       await this.stageRepo.create({
//         organizationId:
//           new Types.ObjectId(
//             organizationId,
//           ),

//         tournamentId:
//           new Types.ObjectId(
//             tournamentId,
//           ),

//         stage,

//         order:
//           this.getStageOrder(
//             stage,
//           ),

//         status:
//           index === 0
//             ? KnockoutStageStatus.ACTIVE
//             : KnockoutStageStatus.PENDING,
//       } as any);
//     }

//     // -------------------------------------------------------
//     // Create knockout matches.
//     // -------------------------------------------------------

//     const created:
//       KnockoutMatchDocument[] =
//       [];

//     for (
//       const definition of definitions
//     ) {
//       const canResolve =
//         this.canResolveFixture(
//           definition.homeSource,
//           definition.awaySource,
//         );

//       const match =
//         await this.knockoutMatchRepo.create({
//           organizationId:
//             new Types.ObjectId(
//               organizationId,
//             ),

//           tournamentId:
//             new Types.ObjectId(
//               tournamentId,
//             ),

//           stage:
//             definition.stage,

//           position:
//             definition.position,

//           fixtureId:
//             null,

//           homeSource:
//             definition.homeSource,

//           awaySource:
//             definition.awaySource,

//           winnerFeedsToPosition:
//             definition.winnerFeedsToPosition ??
//             null,

//           winnerFeedsToStage:
//             definition.winnerFeedsToStage ??
//             null,

//           winnerFeedsToSlot:
//             definition.winnerFeedsToSlot ??
//             null,

//           loserFeedsToPosition:
//             definition.loserFeedsToPosition ??
//             null,

//           loserFeedsToStage:
//             definition.loserFeedsToStage ??
//             null,

//           loserFeedsToSlot:
//             definition.loserFeedsToSlot ??
//             null,

//           status:
//             canResolve
//               ? KnockoutMatchStatus.READY
//               : KnockoutMatchStatus.PENDING,
//         } as any);

//       created.push(match);
//     }

//     // -------------------------------------------------------
//     // Create fixtures for matches whose two teams are already
//     // known.
//     // -------------------------------------------------------

//     for (
//       const match of created
//     ) {
//       await this.tryResolveAndCreateFixture(
//         match._id.toString(),
//         organizationId,
//         tournamentId,
//       );
//     }

//     // -------------------------------------------------------
//     // Activate the first stage.
//     // -------------------------------------------------------

//     if (
//       stages.length > 0
//     ) {
//       const firstStage =
//         await this.stageRepo
//           .findByStageForTenant(
//             tournamentId,
//             organizationId,
//             stages[0],
//           );

//       if (firstStage) {
//         await this.stageRepo.updateById(
//           firstStage._id.toString(),
//           {
//             status:
//               KnockoutStageStatus.ACTIVE,
//           },
//         );
//       }
//     }

//     return created;
//   }

//   // =========================================================
//   // MATCH FINISHED
//   // =========================================================

//   async handleMatchFinished(
//     payload: {
//       matchId: string;
//       fixtureId: string;
//       tournamentId: string;
//       organizationId: string;
//       homeTeamId: string;
//       awayTeamId: string;
//       result: MatchResult;
//     },
//   ) {
//     const {
//       matchId,
//       organizationId,
//       tournamentId,
//       result,
//     } = payload;

//     if (
//       result !==
//         MatchResult.HOME_WIN &&
//       result !==
//         MatchResult.AWAY_WIN
//     ) {
//       // A knockout match cannot advance on a draw.
//       return;
//     }

//     const knockoutMatch =
//       await this.knockoutMatchRepo
//         .findByIdForTenant(
//           matchId,
//           organizationId,
//         );

//     if (!knockoutMatch) {
//       return;
//     }

//     const winnerTeamId =
//       result ===
//       MatchResult.HOME_WIN
//         ? payload.homeTeamId
//         : payload.awayTeamId;

//     const loserTeamId =
//       result ===
//       MatchResult.HOME_WIN
//         ? payload.awayTeamId
//         : payload.homeTeamId;

//     // -------------------------------------------------------
//     // Winner routing.
//     // -------------------------------------------------------

//     if (
//       knockoutMatch
//         .winnerFeedsToStage &&
//       knockoutMatch
//         .winnerFeedsToPosition
//     ) {
//       await this.resolveSlotInto(
//         tournamentId,
//         organizationId,
//         knockoutMatch
//           .winnerFeedsToStage,
//         knockoutMatch
//           .winnerFeedsToPosition,
//         knockoutMatch
//           .winnerFeedsToSlot ??
//           KnockoutTargetSlot.HOME,
//         winnerTeamId,
//         matchId,
//       );
//     }

//     // -------------------------------------------------------
//     // Loser routing.
//     //
//     // Used by optional future third-place / consolation
//     // brackets.
//     // -------------------------------------------------------

//     if (
//       knockoutMatch
//         .loserFeedsToStage &&
//       knockoutMatch
//         .loserFeedsToPosition
//     ) {
//       await this.resolveSlotInto(
//         tournamentId,
//         organizationId,
//         knockoutMatch
//           .loserFeedsToStage,
//         knockoutMatch
//           .loserFeedsToPosition,
//         knockoutMatch
//           .loserFeedsToSlot ??
//           KnockoutTargetSlot.HOME,
//         loserTeamId,
//         matchId,
//       );
//     }

//     await this.markMatchCompleted(
//       knockoutMatch._id.toString(),
//       organizationId,
//     );

//     await this.updateStageStatusAfterMatch(
//       tournamentId,
//       organizationId,
//       knockoutMatch.stage,
//     );
//   }

//   // =========================================================
//   // RESOLVE SLOT
//   // =========================================================

//   private async resolveSlotInto(
//     tournamentId: string,
//     organizationId: string,
//     stage: FixtureStage,
//     position: number,
//     targetSlot: KnockoutTargetSlot,
//     teamId: string,
//     sourceFixtureId: string,
//   ) {
//     const target =
//       await this.knockoutMatchRepo
//         .findByPositionForTenant(
//           tournamentId,
//           organizationId,
//           stage,
//           position,
//         );

//     if (!target) {
//       throw new NotFoundException(
//         `Knockout match ${stage} #${position} was not found.`,
//       );
//     }

//     const source =
//       this.fixedSlot(
//         teamId,
//       );

//     const update: any =
//       {};

//     if (
//       targetSlot ===
//       KnockoutTargetSlot.HOME
//     ) {
//       update.homeSource =
//         source;
//     } else {
//       update.awaySource =
//         source;
//     }

//     const otherSource =
//       targetSlot ===
//       KnockoutTargetSlot.HOME
//         ? target.awaySource
//         : target.homeSource;

//     update.status =
//       this.canResolveFixture(
//         targetSlot ===
//           KnockoutTargetSlot.HOME
//           ? source
//           : otherSource,

//         targetSlot ===
//           KnockoutTargetSlot.HOME
//           ? otherSource
//           : source,
//       )
//         ? KnockoutMatchStatus.READY
//         : KnockoutMatchStatus.PENDING;

//     const updated =
//       await this.knockoutMatchRepo
//         .updateById(
//           target._id.toString(),
//           update,
//         );

//     if (!updated) {
//       throw new NotFoundException(
//         'Knockout match could not be updated.',
//       );
//     }

//     // -------------------------------------------------------
//     // Only create the fixture once both teams are known.
//     // -------------------------------------------------------

//     if (
//       this.canResolveFixture(
//         updated.homeSource,
//         updated.awaySource,
//       )
//     ) {
//       await this.tryResolveAndCreateFixture(
//         updated._id.toString(),
//         organizationId,
//         tournamentId,
//       );
//     }

//     // sourceFixtureId is retained in the source model when
//     // required for audit/history.
//     //
//     // The target slot itself is FIXED now because the actual
//     // team is known.
//     void sourceFixtureId;
//   }

//   // =========================================================
//   // CREATE FIXTURE WHEN READY
//   // =========================================================

//   private async tryResolveAndCreateFixture(
//     knockoutMatchId: string,
//     organizationId: string,
//     tournamentId: string,
//   ) {
//     const knockoutMatch =
//       await this.knockoutMatchRepo
//         .findByIdForTenant(
//           knockoutMatchId,
//           organizationId,
//         );

//     if (!knockoutMatch) {
//       return null;
//     }

//     // Already created.
//     if (
//       knockoutMatch.fixtureId
//     ) {
//       return knockoutMatch;
//     }

//     if (
//       !this.canResolveFixture(
//         knockoutMatch.homeSource,
//         knockoutMatch.awaySource,
//       )
//     ) {
//       return knockoutMatch;
//     }

//     const homeTeamId =
//       knockoutMatch
//         .homeSource
//         .teamId;

//     const awayTeamId =
//       knockoutMatch
//         .awaySource
//         .teamId;

//     if (
//       !homeTeamId ||
//       !awayTeamId
//     ) {
//       return knockoutMatch;
//     }

//     // -------------------------------------------------------
//     // Create actual fixture.
//     //
//     // CreateFixtureDto expects scheduledAt as an ISO string.
//     // -------------------------------------------------------

//     const fixture =
//       await this.fixturesService.create(
//         tournamentId,
//         organizationId,
//         {
//           stage:
//             knockoutMatch.stage,

//           homeSlot:
//             this.fixedSlot(
//               homeTeamId.toString(),
//             ) as any,

//           awaySlot:
//             this.fixedSlot(
//               awayTeamId.toString(),
//             ) as any,

//           scheduledAt:
//             new Date().toISOString(),
//         },
//       );

//     if (!fixture) {
//       return knockoutMatch;
//     }

//     const fixtureId =
//       this.getId(
//         (fixture as any)._id ??
//           (fixture as any).id,
//       );

//     const updated =
//       await this.knockoutMatchRepo
//         .updateById(
//           knockoutMatchId,
//           {
//             fixtureId:
//               new Types.ObjectId(
//                 fixtureId,
//               ),

//             status:
//               KnockoutMatchStatus.READY,
//           } as any,
//         );

//     return updated;
//   }

//   // =========================================================
//   // COMPLETE KNOCKOUT MATCH
//   // =========================================================

//   private async markMatchCompleted(
//     matchId: string,
//     organizationId: string,
//   ) {
//     return this.knockoutMatchRepo
//       .updateById(
//         matchId,
//         {
//           status:
//             KnockoutMatchStatus.COMPLETED,
//         },
//       );
//   }

//   // =========================================================
//   // STAGE STATUS
//   // =========================================================

//   private async updateStageStatusAfterMatch(
//     tournamentId: string,
//     organizationId: string,
//     stage: FixtureStage,
//   ) {
//     const matches =
//       await this.knockoutMatchRepo
//         .findByStageForTenant(
//           tournamentId,
//           organizationId,
//           stage,
//         );

//     if (
//       matches.length === 0
//     ) {
//       return;
//     }

//     const allCompleted =
//       matches.every(
//         (match) =>
//           match.status ===
//           KnockoutMatchStatus.COMPLETED,
//       );

//     const stageDoc =
//       await this.stageRepo
//         .findByStageForTenant(
//           tournamentId,
//           organizationId,
//           stage,
//         );

//     if (!stageDoc) {
//       return;
//     }

//     await this.stageRepo.updateById(
//       stageDoc._id.toString(),
//       {
//         status:
//           allCompleted
//             ? KnockoutStageStatus.COMPLETED
//             : KnockoutStageStatus.ACTIVE,
//       },
//     );

//     // Activate next stage when current stage finishes.
//     if (allCompleted) {
//       const nextStage =
//         this.getNextStage(
//           stage,
//         );

//       if (nextStage) {
//         const nextStageDoc =
//           await this.stageRepo
//             .findByStageForTenant(
//               tournamentId,
//               organizationId,
//               nextStage,
//             );

//         if (nextStageDoc) {
//           await this.stageRepo
//             .updateById(
//               nextStageDoc._id.toString(),
//               {
//                 status:
//                   KnockoutStageStatus.ACTIVE,
//               },
//             );
//         }
//       }
//     }
//   }

//   // =========================================================
//   // SOURCE HELPERS
//   // =========================================================

//   private fixedSlot(
//     teamId: string,
//   ): TeamSlot {
//     return {
//       type:
//         TeamSlotType.FIXED,

//       teamId:
//         new Types.ObjectId(
//           teamId,
//         ),

//       groupId:
//         null,

//       position:
//         null,

//       sourceFixtureId:
//         null,
//     };
//   }

//   private winnerSlot(
//     stage: FixtureStage,
//     position: number,
//   ): TeamSlot {
//     return {
//       type:
//         TeamSlotType.MATCH_WINNER,

//       teamId:
//         null,

//       groupId:
//         null,

//       position:
//         position,

//       sourceFixtureId:
//         null,
//     };
//   }

//   private toSchemaTeamSlot(
//     source: any,
//   ): TeamSlot {
//     return {
//       type:
//         source.type,

//       teamId:
//         source.teamId
//           ? new Types.ObjectId(
//               source.teamId,
//             )
//           : null,

//       groupId:
//         source.groupId
//           ? new Types.ObjectId(
//               source.groupId,
//             )
//           : null,

//       position:
//         source.position ??
//         null,

//       sourceFixtureId:
//         source.sourceFixtureId
//           ? new Types.ObjectId(
//               source.sourceFixtureId,
//             )
//           : null,
//     };
//   }

//   private canResolveFixture(
//     homeSource: TeamSlot,
//     awaySource: TeamSlot,
//   ): boolean {
//     return (
//       homeSource.type ===
//         TeamSlotType.FIXED &&
//       awaySource.type ===
//         TeamSlotType.FIXED &&
//       !!homeSource.teamId &&
//       !!awaySource.teamId
//     );
//   }

//   // =========================================================
//   // QUALIFIER HELPERS
//   // =========================================================

//   private uniqueQualifiedTeams(
//     teams: QualifiedTeam[],
//   ): QualifiedTeam[] {
//     const seen =
//       new Set<string>();

//     const result:
//       QualifiedTeam[] =
//       [];

//     for (
//       const team of teams
//     ) {
//       if (
//         !team.teamId ||
//         seen.has(
//           team.teamId,
//         )
//       ) {
//         continue;
//       }

//       seen.add(
//         team.teamId,
//       );

//       result.push(team);
//     }

//     return result;
//   }

//   private getStandingRankingFields(
//     row: any,
//   ) {
//     return {
//       points:
//         row.points ?? 0,

//       goalDifference:
//         row.goalDifference ??
//         0,

//       goalsFor:
//         row.goalsFor ??
//         0,

//       wins:
//         row.wins ??
//         0,

//       played:
//         row.played ??
//         0,
//     };
//   }

//   private compareStandingRows(
//     a: any,
//     b: any,
//   ): number {
//     const pointsDiff =
//       (b.points ?? 0) -
//       (a.points ?? 0);

//     if (
//       pointsDiff !== 0
//     ) {
//       return pointsDiff;
//     }

//     const goalDifferenceDiff =
//       (b.goalDifference ??
//         0) -
//       (a.goalDifference ??
//         0);

//     if (
//       goalDifferenceDiff !==
//       0
//     ) {
//       return goalDifferenceDiff;
//     }

//     const goalsForDiff =
//       (b.goalsFor ??
//         0) -
//       (a.goalsFor ??
//         0);

//     if (
//       goalsForDiff !== 0
//     ) {
//       return goalsForDiff;
//     }

//     const winsDiff =
//       (b.wins ?? 0) -
//       (a.wins ?? 0);

//     if (
//       winsDiff !== 0
//     ) {
//       return winsDiff;
//     }

//     const positionA =
//       a.groupPosition ??
//       Number.MAX_SAFE_INTEGER;

//     const positionB =
//       b.groupPosition ??
//       Number.MAX_SAFE_INTEGER;

//     return (
//       positionA -
//       positionB
//     );
//   }

//   // =========================================================
//   // STAGE HELPERS
//   // =========================================================

//   private normalizeStage(
//     stage: string,
//   ): string {
//     const normalized = String(
//       stage ?? '',
//     )
//       .trim()
//       .toLowerCase()
//       .replace(/[ -]/g, '_');

//     if (
//       normalized === 'round_of_8' ||
//       normalized === 'quarterfinal' ||
//       normalized === 'quarter_finals'
//     ) {
//       return 'quarter_final';
//     }

//     if (
//       normalized === 'semifinal' ||
//       normalized === 'semi_finals'
//     ) {
//       return 'semi_final';
//     }

//     return normalized;
//   }

//   private isKnownKnockoutStage(
//     stage: string,
//   ): boolean {
//     return [
//       'preliminary',
//       'round_of_64',
//       'round_of_32',
//       'round_of_16',
//       'quarter_final',
//       'semi_final',
//       'final',
//       'third_place',
//     ].includes(
//       stage,
//     );
//   }

//   private getStageForTeamCount(
//     participantCount: number,
//   ): FixtureStage {
//     switch (
//       participantCount
//     ) {
//       case 2:
//         return FixtureStage.FINAL;

//       case 4:
//         return FixtureStage.SEMI_FINAL;

//       case 8:
//         return FixtureStage.QUARTER_FINAL;

//       case 16:
//         return (
//           'round_of_16' as FixtureStage
//         );

//       case 32:
//         return (
//           'round_of_32' as FixtureStage
//         );

//       case 64:
//         return (
//           'round_of_64' as FixtureStage
//         );

//       default:
//         throw new BadRequestException(
//           `Unsupported knockout stage size: ${participantCount} teams.`,
//         );
//     }
//   }

//   private getNextStage(
//     stage: FixtureStage,
//   ): FixtureStage | null {
//     switch (
//       this.normalizeStage(
//         stage,
//       )
//     ) {
//       case 'preliminary':
//         return (
//           'round_of_16' as FixtureStage
//         );

//       case 'round_of_64':
//         return (
//           'round_of_32' as FixtureStage
//         );

//       case 'round_of_32':
//         return (
//           'round_of_16' as FixtureStage
//         );

//       case 'round_of_16':
//         return FixtureStage.QUARTER_FINAL;

//       case 'quarter_final':
//         return FixtureStage.SEMI_FINAL;

//       case 'semi_final':
//         return FixtureStage.FINAL;

//       case 'final':
//         return null;

//       default:
//         return null;
//     }
//   }

//   private getStageOrder(
//     stage: FixtureStage,
//   ): number {
//     switch (
//       this.normalizeStage(
//         stage,
//       )
//     ) {
//       case 'preliminary':
//         return 0;

//       case 'round_of_64':
//         return 1;

//       case 'round_of_32':
//         return 2;

//       case 'round_of_16':
//         return 3;

//       case 'quarter_final':
//         return 4;

//       case 'semi_final':
//         return 5;

//       case 'third_place':
//         return 6;

//       case 'final':
//         return 7;

//       default:
//         return 99;
//     }
//   }

//   // =========================================================
//   // BRACKET VALIDATION
//   // =========================================================

//   private validateBracketDefinition(
//     matches: Array<{
//       stage: FixtureStage;
//       position: number;
//       homeSource: any;
//       awaySource: any;
//     }>,
//   ) {
//     const seen =
//       new Set<string>();

//     for (
//       const match of matches
//     ) {
//       if (
//         !match.stage
//       ) {
//         throw new BadRequestException(
//           'Every knockout match requires a stage.',
//         );
//       }

//       if (
//         !Number.isInteger(
//           match.position,
//         ) ||
//         match.position <= 0
//       ) {
//         throw new BadRequestException(
//           'Knockout match positions must be positive integers.',
//         );
//       }

//       const key =
//         `${match.stage}:${match.position}`;

//       if (
//         seen.has(key)
//       ) {
//         throw new BadRequestException(
//           `Duplicate knockout match position: ${key}.`,
//         );
//       }

//       seen.add(key);

//       this.validateTeamSlot(
//         match.homeSource,
//         'homeSource',
//       );

//       this.validateTeamSlot(
//         match.awaySource,
//         'awaySource',
//       );
//     }
//   }

//   private validateTeamSlot(
//     source: any,
//     field: string,
//   ) {
//     if (
//       !source ||
//       !source.type
//     ) {
//       throw new BadRequestException(
//         `${field}.type is required.`,
//       );
//     }

//     if (
//       source.type ===
//       TeamSlotType.FIXED &&
//       !source.teamId
//     ) {
//       throw new BadRequestException(
//         `${field}.teamId is required for a fixed team slot.`,
//       );
//     }

//     if (
//       source.type ===
//         TeamSlotType.GROUP_POSITION &&
//       (!source.groupId ||
//         !source.position)
//     ) {
//       throw new BadRequestException(
//         `${field} requires groupId and position for group-position slots.`,
//       );
//     }

//     if (
//       source.type ===
//         TeamSlotType.MATCH_WINNER &&
//       !source.position
//     ) {
//       throw new BadRequestException(
//         `${field}.position is required for match-winner slots.`,
//       );
//     }

//     if (
//       source.type ===
//         TeamSlotType.MATCH_LOSER &&
//       !source.position
//     ) {
//       throw new BadRequestException(
//         `${field}.position is required for match-loser slots.`,
//       );
//     }
//   }

//   // =========================================================
//   // POWER OF TWO
//   // =========================================================

//   private nextPowerOfTwo(
//     value: number,
//   ): number {
//     let result = 1;

//     while (
//       result < value
//     ) {
//       result *= 2;
//     }

//     return result;
//   }

//   // =========================================================
//   // ID
//   // =========================================================

//   private getId(
//     value: any,
//   ): string {
//     if (
//       value ===
//       undefined ||
//       value === null
//     ) {
//       throw new BadRequestException(
//         'A required MongoDB identifier is missing.',
//       );
//     }

//     return value.toString();
//   }
// }