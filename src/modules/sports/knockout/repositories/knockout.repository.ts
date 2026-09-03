import { Injectable } from '@nestjs/common';
import {
  InjectModel,
} from '@nestjs/mongoose';
import {
  Model,
  Types,
} from 'mongoose';

import {
  BaseTenantRepository,
} from '../../../../common/base/base-tenant.repository';

import {
  KnockoutStage,
  KnockoutStageDocument,
} from '../schemas/knockout-stage.schema';

import {
  KnockoutMatch,
  KnockoutMatchDocument,
} from '../schemas/knockout-match.schema';

import {
  IKnockoutStageRepository,
  IKnockoutMatchRepository,
} from '../interfaces/knockout-repository.interface';

@Injectable()
export class MongooseKnockoutStageRepository
  extends BaseTenantRepository<KnockoutStageDocument>
  implements IKnockoutStageRepository
{
  constructor(
    @InjectModel(KnockoutStage.name)
    model: Model<KnockoutStageDocument>,
  ) {
    super(model);
  }

  // =========================================================
  // FIND ALL STAGES FOR TOURNAMENT
  // =========================================================

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutStageDocument[]> {
    return this.findManyForTenant(
      organizationId,
      {
        tournamentId:
          new Types.ObjectId(tournamentId),
      } as any,
    );
  }

  // =========================================================
  // FIND ONE STAGE
  // =========================================================

  async findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutStageDocument | null> {
    return this.findOne({
      organizationId: new Types.ObjectId(organizationId),
      tournamentId: new Types.ObjectId(tournamentId),
      stage,
    } as any);
  }
}


@Injectable()
export class MongooseKnockoutMatchRepository
  extends BaseTenantRepository<KnockoutMatchDocument>
  implements IKnockoutMatchRepository
{
  constructor(
    @InjectModel(KnockoutMatch.name)
    model: Model<KnockoutMatchDocument>,
  ) {
    super(model);
  }

  // =========================================================
  // FIND ALL TOURNAMENT MATCHES
  // =========================================================

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument[]> {
    return this.findManyForTenant(
      organizationId,
      {
        tournamentId:
          new Types.ObjectId(tournamentId),
      } as any,
    );
  }

  // =========================================================
  // FIND MATCHES FOR STAGE
  // =========================================================

  async findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutMatchDocument[]> {
    return this.findManyForTenant(
      organizationId,
      {
        tournamentId:
          new Types.ObjectId(tournamentId),

        stage,
      } as any,
    );
  }

  // =========================================================
  // FIND MATCH BY POSITION
  // =========================================================

  async findByPositionForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
    position: number,
  ): Promise<KnockoutMatchDocument | null> {
    return this.findOne({
      organizationId: new Types.ObjectId(organizationId),
      tournamentId: new Types.ObjectId(tournamentId),
      stage,
      position,
    } as any);
  }

  // =========================================================
  // FIND BY FIXTURE
  // =========================================================

  async findByFixtureForTenant(
    fixtureId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument | null> {
    return this.findOne({
      organizationId: new Types.ObjectId(organizationId),
      fixtureId: new Types.ObjectId(fixtureId),
    } as any);
  }
}