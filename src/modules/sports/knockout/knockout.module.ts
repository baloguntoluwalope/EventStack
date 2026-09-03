import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  KnockoutStage,
  KnockoutStageSchema,
} from './schemas/knockout-stage.schema';

import {
  KnockoutMatch,
  KnockoutMatchSchema,
} from './schemas/knockout-match.schema';

import {
  MongooseKnockoutStageRepository,
  MongooseKnockoutMatchRepository,
} from './repositories/knockout.repository';

import {
  KNOCKOUT_STAGE_REPOSITORY,
  KNOCKOUT_MATCH_REPOSITORY,
} from './interfaces/knockout-repository.interface';

import { KnockoutService } from './knockout.service';
import { KnockoutController } from './knockout.controller';

import { FixturesModule } from '../fixtures/fixtures.module';
import { GroupsModule } from '../groups/groups.module';
import { StandingsModule } from '../standings/standings.module';
import { MembersModule } from '../../tenancy/members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KnockoutStage.name, schema: KnockoutStageSchema },
      { name: KnockoutMatch.name, schema: KnockoutMatchSchema },
    ]),
    FixturesModule,
    GroupsModule,
    StandingsModule,
    MembersModule,
  ],

  providers: [
    {
      provide: KNOCKOUT_STAGE_REPOSITORY,
      useClass: MongooseKnockoutStageRepository,
    },
    {
      provide: KNOCKOUT_MATCH_REPOSITORY,
      useClass: MongooseKnockoutMatchRepository,
    },
    KnockoutService,
  ],

  controllers: [KnockoutController],

  exports: [
    KnockoutService,
    KNOCKOUT_MATCH_REPOSITORY, // <-- ADD THIS
  ],
})
export class KnockoutModule {}