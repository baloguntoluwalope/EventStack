import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';

import { Types } from 'mongoose';

import {
  IFixtureRepository,
  FIXTURE_REPOSITORY,
  FixtureFilters,
} from './interfaces/fixture-repository.interface';

import {
  assertFound,
} from '../../../common/utils/assert-found.util';

import {
  CreateFixtureDto,
} from './dto/create-fixture.dto';

import {
  FixtureStatus,
  TeamSlotType,
} from './schemas/fixture.schema';

import {
  TournamentsService,
} from '../tournaments/tournaments.service';

import {
  GroupsService,
} from '../groups/groups.service';

import {
  TeamsService,
} from '../teams/teams.service';

@Injectable()
export class FixturesService {
  constructor(
    @Inject(FIXTURE_REPOSITORY)
    private readonly fixtureRepo: IFixtureRepository,

    private readonly tournamentsService: TournamentsService,

    private readonly groupsService: GroupsService,

    private readonly teamsService: TeamsService,
  ) {}

  // =========================================================
  // CREATE FIXTURE
  // =========================================================

  async create(
    tournamentId: string,
    organizationId: string,
    dto: CreateFixtureDto,
  ) {
    if (!tournamentId) {
      throw new BadRequestException(
        'Tournament ID is required.',
      );
    }

    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required.',
      );
    }

    if (!dto) {
      throw new BadRequestException(
        'Fixture data is required.',
      );
    }

    // -------------------------------------------------------
    // VERIFY TOURNAMENT
    // -------------------------------------------------------

    await this.tournamentsService.findByIdOrThrow(
      tournamentId,
      organizationId,
    );

    // -------------------------------------------------------
    // VERIFY GROUP
    // -------------------------------------------------------

    if (dto.groupId) {
      await this.groupsService.findByIdOrThrow(
        dto.groupId,
        organizationId,
      );
    }

    // -------------------------------------------------------
    // VERIFY HOME SLOT
    // -------------------------------------------------------

    await this.validateSlot(
      dto.homeSlot,
      tournamentId,
      organizationId,
    );

    // -------------------------------------------------------
    // VERIFY AWAY SLOT
    // -------------------------------------------------------

    await this.validateSlot(
      dto.awaySlot,
      tournamentId,
      organizationId,
    );

    // -------------------------------------------------------
    // TEAM CANNOT PLAY ITSELF
    // -------------------------------------------------------

    if (
      dto.homeSlot.type ===
        TeamSlotType.FIXED &&
      dto.awaySlot.type ===
        TeamSlotType.FIXED &&
      dto.homeSlot.teamId &&
      dto.awaySlot.teamId &&
      String(dto.homeSlot.teamId) ===
        String(dto.awaySlot.teamId)
    ) {
      throw new BadRequestException(
        'A team cannot play itself.',
      );
    }

    // -------------------------------------------------------
    // NORMALIZE SLOT
    // -------------------------------------------------------

    const normalizeSlot = (
      slot: CreateFixtureDto['homeSlot'],
    ) => ({
      type: slot.type,

      teamId:
        slot.teamId &&
        Types.ObjectId.isValid(
          slot.teamId,
        )
          ? new Types.ObjectId(
              slot.teamId,
            )
          : null,

      groupId:
        slot.groupId &&
        Types.ObjectId.isValid(
          slot.groupId,
        )
          ? new Types.ObjectId(
              slot.groupId,
            )
          : null,

      position:
        slot.position ?? null,

      sourceFixtureId:
        slot.sourceFixtureId &&
        Types.ObjectId.isValid(
          slot.sourceFixtureId,
        )
          ? new Types.ObjectId(
              slot.sourceFixtureId,
            )
          : null,
    });

    // -------------------------------------------------------
    // DATE
    // -------------------------------------------------------

    const scheduledAt =
      new Date(
        dto.scheduledAt,
      );

    if (
      Number.isNaN(
        scheduledAt.getTime(),
      )
    ) {
      throw new BadRequestException(
        'scheduledAt must be a valid date.',
      );
    }

    // -------------------------------------------------------
    // CREATE
    // -------------------------------------------------------

    return this.fixtureRepo.create({
      ...dto,

      homeSlot:
        normalizeSlot(
          dto.homeSlot,
        ),

      awaySlot:
        normalizeSlot(
          dto.awaySlot,
        ),

      groupId:
        dto.groupId &&
        Types.ObjectId.isValid(
          dto.groupId,
        )
          ? new Types.ObjectId(
              dto.groupId,
            )
          : null,

      scheduledAt,

      tournamentId:
        new Types.ObjectId(
          tournamentId,
        ),

      organizationId:
        new Types.ObjectId(
          organizationId,
        ),

      status:
        FixtureStatus.SCHEDULED,
    });
  }

  // =========================================================
  // VALIDATE SLOT
  // =========================================================

  private async validateSlot(
    slot: {
      type: TeamSlotType;
      teamId?: string;
      groupId?: string;
      position?: number;
      sourceFixtureId?: string;
    },
    tournamentId: string,
    organizationId: string,
  ) {
    // -------------------------------------------------------
    // FIXED TEAM
    // -------------------------------------------------------

    if (
      slot.type ===
      TeamSlotType.FIXED
    ) {
      if (!slot.teamId) {
        throw new BadRequestException(
          'A fixed slot requires teamId.',
        );
      }

      await this.teamsService.assertRegistered(
        organizationId,
        tournamentId,
        slot.teamId,
      );

      return;
    }

    // -------------------------------------------------------
    // GROUP POSITION
    // -------------------------------------------------------

    if (
      slot.type ===
      TeamSlotType.GROUP_POSITION
    ) {
      if (!slot.groupId) {
        throw new BadRequestException(
          'A group-position slot requires groupId.',
        );
      }

      if (
        slot.position ===
          undefined ||
        slot.position === null
      ) {
        throw new BadRequestException(
          'A group-position slot requires position.',
        );
      }

      await this.groupsService.findByIdOrThrow(
        slot.groupId,
        organizationId,
      );

      return;
    }

    // -------------------------------------------------------
    // MATCH WINNER / LOSER
    // -------------------------------------------------------

    if (
      slot.type ===
        TeamSlotType.MATCH_WINNER ||
      slot.type ===
        TeamSlotType.MATCH_LOSER
    ) {
      if (!slot.sourceFixtureId) {
        throw new BadRequestException(
          'A knockout slot requires sourceFixtureId.',
        );
      }

      const sourceFixture =
        await this.fixtureRepo.findByIdForTenant(
          slot.sourceFixtureId,
          organizationId,
        );

      if (!sourceFixture) {
        throw new BadRequestException(
          'Source fixture not found.',
        );
      }

      return;
    }

    throw new BadRequestException(
      'Invalid fixture team slot type.',
    );
  }

  // =========================================================
  // GET FIXTURE
  // =========================================================

  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    return assertFound(
      await this.fixtureRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Fixture not found',
    );
  }

  // =========================================================
  // PUBLIC GET
  // =========================================================

  async findByIdPublicOrThrow(
    id: string,
  ) {
    return assertFound(
      await this.fixtureRepo.findByIdPublic(
        id,
      ),
      'Fixture not found',
    );
  }

  // =========================================================
  // LIST
  // =========================================================

  listForTournament(
    tournamentId: string,
    organizationId: string,
    filters?: FixtureFilters,
  ) {
    return this.fixtureRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
      filters,
    );
  }

  // =========================================================
  // PUBLIC LIST
  // =========================================================

  async listForTournamentPublic(
    tournamentId: string,
    organizationId: string,
    filters?: FixtureFilters,
  ) {
    const fixtures =
      await this.listForTournament(
        tournamentId,
        organizationId,
        filters,
      );

    if (
      fixtures.length === 0
    ) {
      return [];
    }

    // -------------------------------------------------------
    // COLLECT TEAM IDS
    // -------------------------------------------------------

    const teamIds =
      fixtures
        .flatMap(
          (fixture) => [
            fixture.homeSlot?.teamId,
            fixture.awaySlot?.teamId,
          ],
        )
        .filter(Boolean)
        .map((id) =>
          String(id),
        );

    // -------------------------------------------------------
    // LOAD PUBLIC TEAM DATA
    //
    // getPublicNamesMap currently returns:
    // id
    // name
    // shortName
    // logoUrl
    // -------------------------------------------------------

    const teamMap =
      await this.teamsService.getPublicNamesMap(
        teamIds,
      );

    // -------------------------------------------------------
    // RETURN ENRICHED FIXTURES
    // -------------------------------------------------------

    return fixtures.map(
      (fixture) => {
        const homeId =
          fixture.homeSlot?.teamId
            ? String(
                fixture.homeSlot.teamId,
              )
            : null;

        const awayId =
          fixture.awaySlot?.teamId
            ? String(
                fixture.awaySlot.teamId,
              )
            : null;

        const homeTeam =
          homeId
            ? teamMap[homeId]
            : null;

        const awayTeam =
          awayId
            ? teamMap[awayId]
            : null;

        const plainFixture =
          typeof (
            fixture as any
          ).toObject === 'function'
            ? (
                fixture as any
              ).toObject()
            : fixture;

        return {
          ...plainFixture,

          // -------------------------------------------------
          // HOME TEAM
          // -------------------------------------------------

          homeTeamName:
            homeTeam?.name ??
            'TBD',

          homeTeamShortName:
            homeTeam?.shortName ??
            null,

          homeTeamLogoUrl:
            homeTeam?.logoUrl ??
            null,

          // -------------------------------------------------
          // AWAY TEAM
          // -------------------------------------------------

          awayTeamName:
            awayTeam?.name ??
            'TBD',

          awayTeamShortName:
            awayTeam?.shortName ??
            null,

          awayTeamLogoUrl:
            awayTeam?.logoUrl ??
            null,
        };
      },
    );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    id: string,
    organizationId: string,
    data: Partial<CreateFixtureDto>,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.fixtureRepo.updateById(
        id,
        data as any,
      ),
      'Fixture not found',
    );
  }

  // =========================================================
  // POSTPONE
  // =========================================================

  async postpone(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.fixtureRepo.updateById(
        id,
        {
          status:
            FixtureStatus.POSTPONED,
        },
      ),
      'Fixture not found',
    );
  }

  // =========================================================
  // CANCEL
  // =========================================================

  async cancel(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.fixtureRepo.updateById(
        id,
        {
          status:
            FixtureStatus.CANCELLED,
        },
      ),
      'Fixture not found',
    );
  }

  // =========================================================
  // COMPLETE
  // =========================================================

  async markCompleted(
    id: string,
    organizationId: string,
  ) {
    // IMPORTANT:
    // Verify tenant ownership before changing
    // fixture status.

    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.fixtureRepo.updateById(
        id,
        {
          status:
            FixtureStatus.COMPLETED,
        },
      ),
      'Fixture not found',
    );
  }
}