import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';

import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';

import {
  Tournament,
  TournamentDocument,
} from '../schemas/tournament.schema';

import {
  ITournamentRepository,
} from '../interfaces/tournament-repository.interface';

@Injectable()
export class MongooseTournamentRepository
  extends BaseTenantRepository<TournamentDocument>
  implements ITournamentRepository
{
  constructor(
    @InjectModel(Tournament.name)
    private readonly tournamentModel: Model<TournamentDocument>,
  ) {
    super(tournamentModel);
  }

  // =========================================================
  // CREATE
  // =========================================================

  override create(
    data: Partial<TournamentDocument>,
    session?: ClientSession,
  ): Promise<TournamentDocument> {
    return this.tournamentModel
      .create([data], { session })
      .then((docs) => docs[0] as TournamentDocument);
  }

  // =========================================================
  // FIND TOURNAMENTS FOR EVENT
  // =========================================================

  async findByEventForTenant(
    eventId: string,
    organizationId: string,
  ): Promise<TournamentDocument[]> {
    if (!eventId || !organizationId) {
      return [];
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return [];
    }

    if (!Types.ObjectId.isValid(organizationId)) {
      return [];
    }

    const eventObjectId = new Types.ObjectId(eventId);
    const organizationObjectId = new Types.ObjectId(
      organizationId,
    );

    console.log(
      '[TournamentRepository] Finding tournament for event:',
      {
        eventId,
        organizationId,
      },
    );

    const tournaments =
      await this.tournamentModel
        .find({
          eventId: eventObjectId,
          organizationId: organizationObjectId,
          deletedAt: null,
        })
        .sort({ createdAt: 1 })
        .exec();

    console.log(
      '[TournamentRepository] Found tournaments:',
      tournaments.map((tournament) => ({
        id: String(tournament._id),
        name: tournament.name,
        eventId: String(tournament.eventId),
        organizationId: String(
          tournament.organizationId,
        ),
      })),
    );

    return tournaments;
  }

  // =========================================================
  // FIND ONE FOR EVENT
  // =========================================================

  async findOneByEventForTenant(
    eventId: string,
    organizationId: string,
  ): Promise<TournamentDocument | null> {
    if (!eventId || !organizationId) {
      return null;
    }

    if (
      !Types.ObjectId.isValid(eventId) ||
      !Types.ObjectId.isValid(organizationId)
    ) {
      return null;
    }

    return this.tournamentModel
      .findOne({
        eventId: new Types.ObjectId(eventId),
        organizationId: new Types.ObjectId(
          organizationId,
        ),
        deletedAt: null,
      })
      .sort({ createdAt: 1 })
      .exec();
  }

    // =========================================================
  // FIND TOURNAMENTS FOR PUBLIC EVENT
  // =========================================================

  async findByEventPublic(
    eventId: string,
  ): Promise<TournamentDocument[]> {
    if (!eventId) {
      return [];
    }

    if (!Types.ObjectId.isValid(eventId)) {
      return [];
    }

    return this.tournamentModel
      .find({
        eventId: new Types.ObjectId(eventId),
        deletedAt: null,
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  // =========================================================
  // FIND BY ID PUBLIC
  // =========================================================

  findByIdPublic(id: string) {
    return this.findById(id);
  }
}