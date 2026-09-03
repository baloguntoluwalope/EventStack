import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';

import {
  Types,
  ClientSession,
} from 'mongoose';

import {
  ITournamentRepository,
  TOURNAMENT_REPOSITORY,
} from './interfaces/tournament-repository.interface';


import {
  IEventRepository,
  EVENT_REPOSITORY,
} from '../../events/interfaces/event-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import {
  CreateTournamentDto,
} from './dto/create-tournament.dto';

import {
  UpdateTournamentDto,
} from './dto/update-tournament.dto';

import {
  TournamentStatus,
  TournamentFormat,
} from './schemas/tournament.schema';

import { EventStatus } from '../../../common/constants/event-status.constants';

@Injectable()
export class TournamentsService {
  constructor(
    @Inject(TOURNAMENT_REPOSITORY)
    private readonly tournamentRepo: ITournamentRepository,
    @Inject(EVENT_REPOSITORY)
private readonly eventRepo: IEventRepository,
  ) {}
  

  // =========================================================
  // OBJECT ID
  // =========================================================

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `Invalid ID format: ${id}`,
      );
    }

    return new Types.ObjectId(id);
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    organizationId: string,
    eventId: string,
    dto: CreateTournamentDto,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required.',
      );
    }

    if (!eventId) {
      throw new BadRequestException(
        'Event ID is required.',
      );
    }

    return this.tournamentRepo.create({
      ...dto,

      organizationId:
        this.toObjectId(organizationId) as any,

      eventId:
        this.toObjectId(eventId) as any,
    });
  }

  // =========================================================
  // CREATE WITH SESSION
  // =========================================================

  async createWithSession(
    organizationId: string,
    eventId: string,
    dto: Partial<CreateTournamentDto>,
    session: ClientSession,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'Organization ID is required.',
      );
    }

    if (!eventId) {
      throw new BadRequestException(
        'Event ID is required.',
      );
    }

    return this.tournamentRepo.create(
      {
        ...dto,

        name:
          dto.name ||
          'Main Tournament',

        sport:
          dto.sport ||
          'football',

        format:
          dto.format ||
          TournamentFormat.KNOCKOUT_ONLY,

        organizationId:
          this.toObjectId(organizationId) as any,

        eventId:
          this.toObjectId(eventId) as any,

        status:
          TournamentStatus.DRAFT,
      },

      session,
    );
  }

  // =========================================================
  // FIND BY ID
  // =========================================================

  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    return assertFound(
      await this.tournamentRepo.findByIdForTenant(
        id,
        organizationId,
      ),
      'Tournament not found',
    );
  }

  // =========================================================
  // FIND TOURNAMENTS FOR EVENT
  // =========================================================

  async listForEvent(
    eventId: string,
    organizationId: string,
  ) {
    if (!eventId || !organizationId) {
      return [];
    }

    return this.tournamentRepo.findByEventForTenant(
      eventId,
      organizationId,
    );
  }

  // =========================================================
  // GET THE TOURNAMENT FOR THIS EXACT EVENT
  // =========================================================

  async findOneByEventOrThrow(
    eventId: string,
    organizationId: string,
  ) {
    if (!eventId) {
      throw new BadRequestException(
        'Event ID is required.',
      );
    }

    const tournaments =
      await this.listForEvent(
        eventId,
        organizationId,
      );

    if (
      !tournaments ||
      tournaments.length === 0
    ) {
      throw new NotFoundException(
        `No tournament exists for event ${eventId}`,
      );
    }

    /*
     * IMPORTANT:
     *
     * We return a tournament ONLY when its eventId
     * exactly matches the requested event.
     *
     * There is NO fallback to another tournament.
     */

    const tournament =
      tournaments.find(
        (item: any) =>
          String(item.eventId) ===
          String(eventId),
      );

    if (!tournament) {
      throw new NotFoundException(
        `No tournament exists for event ${eventId}`,
      );
    }

    return tournament;
  }

  // =========================================================
  // DO NOT USE THIS FOR NORMAL EVENT CREATION
  // =========================================================

  async findOrCreateForEvent(
    organizationId: string,
    eventId: string,
    defaultDto?: Partial<CreateTournamentDto>,
  ) {
    const existing =
      await this.listForEvent(
        eventId,
        organizationId,
      );

    if (
      existing &&
      existing.length > 0
    ) {
      return existing[0];
    }

    return this.create(
      organizationId,
      eventId,
      {
        name:
          defaultDto?.name ||
          'Main Tournament',

        sport:
          defaultDto?.sport ||
          'football',

        format:
          defaultDto?.format ||
          TournamentFormat.KNOCKOUT_ONLY,

        ...defaultDto,
      } as CreateTournamentDto,
    );
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    id: string,
    organizationId: string,
    dto: UpdateTournamentDto,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.tournamentRepo.updateById(
        id,
        dto,
      ),
      'Tournament not found',
    );
  }

  // =========================================================
  // PUBLISH
  // =========================================================

  async publish(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.tournamentRepo.updateById(
        id,
        {
          status:
            TournamentStatus.PUBLISHED,
        },
      ),
      'Tournament not found',
    );
  }

  // =========================================================
  // UNPUBLISH
  // =========================================================

  async unpublish(
    id: string,
    organizationId: string,
  ) {
    await this.findByIdOrThrow(
      id,
      organizationId,
    );

    return assertFound(
      await this.tournamentRepo.updateById(
        id,
        {
          status:
            TournamentStatus.DRAFT,
        },
      ),
      'Tournament not found',
    );
  }

  // =========================================================
  // DELETE
  // =========================================================

  async remove(
    id: string,
    organizationId: string,
  ) {
    return assertDeleted(
      await this.tournamentRepo.deleteByIdForTenant(
        id,
        organizationId,
      ),
      'Tournament not found',
    );
  }

 
// =========================================================
// PUBLIC TOURNAMENTS FOR EVENT
// =========================================================

// =========================================================
// PUBLIC
// =========================================================

async findByIdPublicOrThrow(
  id: string,
) {
  const objectId = this.toObjectId(id);

  const tournament =
    await assertFound(
      await this.tournamentRepo.findByIdPublic(
        objectId.toString(),
      ),
      'Tournament not found',
    );

  await this.assertEventIsPublished(
    tournament.eventId.toString(),
  );

  return tournament;
}

// =========================================================
// PUBLIC TOURNAMENTS FOR EVENT
// =========================================================

async listPublicForEvent(
  eventId: string,
) {
  if (!eventId) {
    throw new BadRequestException(
      'Event ID is required.',
    );
  }

  /**
   * Validate the Event ID before querying MongoDB.
   */
  this.toObjectId(eventId);

  /**
   * First verify that THIS EXACT EVENT exists
   * and is publicly visible.
   *
   * Do not resolve a tournament by treating
   * eventId as a tournamentId.
   */
  await this.assertEventIsPublished(
    eventId,
  );

  /**
   * Now resolve tournaments that actually belong
   * to this event.
   */
  const tournaments =
    await this.tournamentRepo.findByEventPublic(
      eventId,
    );

  if (!tournaments) {
    return [];
  }

  /**
   * Extra protection:
   *
   * Never accidentally expose a tournament
   * belonging to another event.
   */
  return tournaments.filter(
    (tournament: any) =>
      String(
        tournament.eventId,
      ) === String(eventId),
  );
}

// =========================================================
// PUBLIC EVENT VISIBILITY
// =========================================================

private async assertEventIsPublished(
  eventId: string,
) {
  if (!eventId) {
    throw new BadRequestException(
      'Event ID is required.',
    );
  }

  this.toObjectId(eventId);

  const event =
    await this.eventRepo.findById(
      eventId,
    );

  if (!event) {
    throw new NotFoundException(
      'Event not found',
    );
  }

  if (
    event.status !==
    EventStatus.PUBLISHED
  ) {
    throw new NotFoundException(
      'Event not found',
    );
  }

  return event;
}
}