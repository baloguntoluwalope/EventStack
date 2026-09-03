import {
  BadRequestException,
  Injectable,
  Inject,
} from '@nestjs/common';

import {
  IGroupRepository,
  GROUP_REPOSITORY,
} from './interfaces/group-repository.interface';

import {
  assertDeleted,
  assertFound,
} from '../../../common/utils/assert-found.util';

import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(GROUP_REPOSITORY)
    private readonly groupRepo: IGroupRepository,
  ) {}

  /**
   * Create group inside a tournament.
   */
  async create(
    tournamentId: string,
    organizationId: string,
    dto: CreateGroupDto,
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

    if (!dto?.name?.trim()) {
      throw new BadRequestException(
        'Group name is required.',
      );
    }

    return this.groupRepo.create({
      ...dto,
      name: dto.name.trim(),
      order: dto.order ?? 0,
      tournamentId: tournamentId as any,
      organizationId: organizationId as any,
    });
  }

  /**
   * List groups for a tournament.
   */
  async listForTournament(
    tournamentId: string,
    organizationId: string,
  ) {
    if (!tournamentId || !organizationId) {
      return [];
    }

    return this.groupRepo.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );
  }

  /**
   * Get one group.
   */
  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    if (!id) {
      throw new BadRequestException(
        'Group ID is required.',
      );
    }

    return assertFound(
      await this.groupRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Group not found',
    );
  }

  /**
   * Update group.
   */
  async update(
    id: string,
    organizationId: string,
    dto: Partial<CreateGroupDto>,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    const safeData: Record<string, any> = {};

    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException(
          'Group name cannot be empty.',
        );
      }

      safeData.name =
        dto.name.trim();
    }

    if (dto.order !== undefined) {
      safeData.order =
        dto.order;
    }

    return assertFound(
      await this.groupRepo.updateById(
        id,
        safeData,
      ),
      'Group not found',
    );
  }

  /**
   * Soft delete group.
   */
  async remove(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertDeleted(
      await this.groupRepo.deleteByIdForTenant(
        id,
        organizationId,
      ),
      'Group not found',
    );
  }


  /**
 * List groups for a public tournament.
 *
 * The controller must verify that the tournament belongs to
 * a published EventStack event before calling this method.
 */
async listPublicForTournament(
  tournamentId: string,
  organizationId: string,
) {
  if (!tournamentId || !organizationId) {
    return [];
  }


  return this.groupRepo.findByTournamentForTenant(
    tournamentId,
    organizationId,
  );
}
}