import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { BaseTenantRepository } from '../../../../common/base/base-tenant.repository';
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

// =========================================================
// STAGE REPOSITORY
// =========================================================

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

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutStageDocument[]> {
    const stages = await this.findManyForTenant(organizationId, {
      tournamentId: new Types.ObjectId(tournamentId),
    } as any);

    return [...stages].sort((a, b) => a.order - b.order);
  }

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

  async findNextStageForTenant(
    tournamentId: string,
    organizationId: string,
    currentOrder: number,
  ): Promise<KnockoutStageDocument | null> {
    const stages = await this.findByTournamentForTenant(
      tournamentId,
      organizationId,
    );

    return stages.find((s) => s.order > currentOrder) ?? null;
  }
}

// =========================================================
// MATCH REPOSITORY
// =========================================================

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

  async findByTournamentForTenant(
    tournamentId: string,
    organizationId: string,
  ): Promise<KnockoutMatchDocument[]> {
    return this.findManyForTenant(organizationId, {
      tournamentId: new Types.ObjectId(tournamentId),
    } as any);
  }

  async findByStageForTenant(
    tournamentId: string,
    organizationId: string,
    stage: string,
  ): Promise<KnockoutMatchDocument[]> {
    return this.findManyForTenant(organizationId, {
      tournamentId: new Types.ObjectId(tournamentId),
      stage,
    } as any);
  }

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

// import {
//   Injectable,
// } from '@nestjs/common';

// import {
//   InjectModel,
// } from '@nestjs/mongoose';

// import {
//   Model,
//   Types,
// } from 'mongoose';

// import {
//   BaseTenantRepository,
// } from '../../../../common/base/base-tenant.repository';

// import {
//   KnockoutStage,
//   KnockoutStageDocument,
// } from '../schemas/knockout-stage.schema';

// import {
//   KnockoutMatch,
//   KnockoutMatchDocument,
// } from '../schemas/knockout-match.schema';

// import {
//   IKnockoutStageRepository,
//   IKnockoutMatchRepository,
// } from '../interfaces/knockout-repository.interface';

// // =========================================================
// // STAGE REPOSITORY
// // =========================================================

// @Injectable()
// export class MongooseKnockoutStageRepository
//   extends BaseTenantRepository<KnockoutStageDocument>
//   implements IKnockoutStageRepository
// {
//   constructor(
//     @InjectModel(KnockoutStage.name)
//     model: Model<KnockoutStageDocument>,
//   ) {
//     super(model);
//   }

//   async findByTournamentForTenant(
//     tournamentId: string,
//     organizationId: string,
//   ): Promise<KnockoutStageDocument[]> {
//     return this.findManyForTenant(
//       organizationId,
//       {
//         tournamentId:
//           new Types.ObjectId(tournamentId),
//       } as any,
//     );
//   }

//   async findByStageForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//   ): Promise<KnockoutStageDocument | null> {
//     return this.findOne({
//       organizationId:
//         new Types.ObjectId(organizationId),

//       tournamentId:
//         new Types.ObjectId(tournamentId),

//       stage,
//     } as any);
//   }
// }

// // =========================================================
// // MATCH REPOSITORY
// // =========================================================

// @Injectable()
// export class MongooseKnockoutMatchRepository
//   extends BaseTenantRepository<KnockoutMatchDocument>
//   implements IKnockoutMatchRepository
// {
//   constructor(
//     @InjectModel(KnockoutMatch.name)
//     model: Model<KnockoutMatchDocument>,
//   ) {
//     super(model);
//   }

//   async findByTournamentForTenant(
//     tournamentId: string,
//     organizationId: string,
//   ): Promise<KnockoutMatchDocument[]> {
//     return this.findManyForTenant(
//       organizationId,
//       {
//         tournamentId:
//           new Types.ObjectId(tournamentId),
//       } as any,
//     );
//   }

//   async findByStageForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//   ): Promise<KnockoutMatchDocument[]> {
//     return this.findManyForTenant(
//       organizationId,
//       {
//         tournamentId:
//           new Types.ObjectId(tournamentId),

//         stage,
//       } as any,
//     );
//   }

//   async findByPositionForTenant(
//     tournamentId: string,
//     organizationId: string,
//     stage: string,
//     position: number,
//   ): Promise<KnockoutMatchDocument | null> {
//     return this.findOne({
//       organizationId:
//         new Types.ObjectId(organizationId),

//       tournamentId:
//         new Types.ObjectId(tournamentId),

//       stage,

//       position,
//     } as any);
//   }

//   async findByFixtureForTenant(
//     fixtureId: string,
//     organizationId: string,
//   ): Promise<KnockoutMatchDocument | null> {
//     return this.findOne({
//       organizationId:
//         new Types.ObjectId(organizationId),

//       fixtureId:
//         new Types.ObjectId(fixtureId),
//     } as any);
//   }
// }