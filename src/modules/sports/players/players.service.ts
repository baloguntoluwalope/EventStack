import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';

import {
  IPlayerRepository,
  PLAYER_REPOSITORY,
} from './interfaces/player-repository.interface';

import {
  assertDeleted,
  assertFound,
} from '../../../common/utils/assert-found.util';

import {
  CreatePlayerDto,
} from './dto/create-player.dto';

import {
  UpdatePlayerDto,
} from './dto/update-player.dto';

import {
  TeamsService,
} from '../teams/teams.service';

@Injectable()
export class PlayersService {
  constructor(
    @Inject(PLAYER_REPOSITORY)
    private readonly playerRepo: IPlayerRepository,

    private readonly teamsService: TeamsService,
  ) {}

  /**
   * Create player and attach to a team.
   */
  async create(
    teamId: string,
    organizationId: string,
    dto: CreatePlayerDto,
  ) {
    if (!teamId) {
      throw new BadRequestException(
        'Team ID is required.',
      );
    }

    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required.',
      );
    }

    /*
     * IMPORTANT:
     * Verify that the team actually belongs
     * to this organization before creating
     * the player.
     */
    await this.teamsService.findByIdOrThrow(
      teamId,
      organizationId,
    );

    return this.playerRepo.create({
      ...dto,
      teamId: teamId as any,
      organizationId: organizationId as any,
    });
  }

  /**
   * List the roster for a team.
   */
  async listForTeam(
    teamId: string,
    organizationId: string,
  ) {
    if (!teamId || !organizationId) {
      return [];
    }

    /*
     * Verify the team belongs to the organization.
     */
    await this.teamsService.findByIdOrThrow(
      teamId,
      organizationId,
    );

    return this.playerRepo.findByTeamForTenant(
      teamId,
      organizationId,
    );
  }

  /**
   * Update player details.
   */
  async update(
    id: string,
    organizationId: string,
    dto: UpdatePlayerDto,
  ) {
    const existingPlayer =
      await assertFound(
        await this.playerRepo.findByIdForTenant(
          id,
          organizationId,
        ),
        'Player not found',
      );

    /*
     * If team is being changed, verify the
     * destination team belongs to the same org.
     */
    if (dto.teamId) {
      await this.teamsService.findByIdOrThrow(
        dto.teamId,
        organizationId,
      );
    }

    return assertFound(
      await this.playerRepo.updateById(
        id,
        dto as any,
      ),
      'Player not found',
    );
  }

  /**
   * Remove player.
   */
  async remove(
    id: string,
    organizationId: string,
  ) {
    await assertFound(
      await this.playerRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Player not found',
    );

    return assertDeleted(
      await this.playerRepo.deleteByIdForTenant(
        id,
        organizationId,
      ),
      'Player not found',
    );
  }
}


// import { Injectable, Inject, BadRequestException } from '@nestjs/common';
// import { IPlayerRepository, PLAYER_REPOSITORY } from './interfaces/player-repository.interface';
// import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
// import { CreatePlayerDto } from './dto/create-player.dto';
// import { UpdatePlayerDto } from './dto/update-player.dto';
// import { TeamsService } from '../teams/teams.service';

// @Injectable()
// export class PlayersService {
//   constructor(
//     @Inject(PLAYER_REPOSITORY) private playerRepo: IPlayerRepository,
//     private teamsService: TeamsService,
//   ) {}

//   create(teamId: string, organizationId: string, dto: CreatePlayerDto) {
//     return this.playerRepo.create({ ...dto, teamId: teamId as any, organizationId: organizationId as any });
//   }

//   listForTeam(teamId: string, organizationId: string) {
//     return this.playerRepo.findByTeamForTenant(teamId, organizationId);
//   }

//   async update(id: string, organizationId: string, dto: UpdatePlayerDto) {
//     await assertFound(await this.playerRepo.findByIdForTenant(id, organizationId), 'Player not found');

//     if (dto.teamId) {
//       // findByIdOrThrow is itself tenant-scoped (findByIdForTenant under
//       // the hood) — this is the actual cross-tenant guard: a destination
//       // team that doesn't belong to this organization will throw
//       // NotFoundException here, never silently succeed.
//       await this.teamsService.findByIdOrThrow(dto.teamId, organizationId);
//     }

//     return assertFound(await this.playerRepo.updateById(id, dto as any), 'Player not found');
//   }

//   async remove(id: string, organizationId: string) {
//     return assertDeleted(await this.playerRepo.deleteByIdForTenant(id, organizationId), 'Player not found');
//   }
// }