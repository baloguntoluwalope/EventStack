import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Match, MatchSchema } from './schemas/match.schema';
import { MongooseMatchRepository } from './repositories/match.repository';
import { MATCH_REPOSITORY } from './interfaces/match-repository.interface';
import { MatchesService } from './matches.service';
import { MatchesController, PublicMatchesController } from './matches.controller';

import { MembersModule } from '../../tenancy/members/members.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { KnockoutModule } from '../knockout/knockout.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Match.name,
        schema: MatchSchema,
      },
    ]),

    MembersModule,
    FixturesModule,
    forwardRef(() => KnockoutModule),
  ],

  providers: [
    {
      provide: MATCH_REPOSITORY,
      useClass: MongooseMatchRepository,
    },
    MatchesService,
  ],

  controllers: [MatchesController,PublicMatchesController],

  exports: [
    MatchesService,
    MATCH_REPOSITORY,
  ],
})
export class MatchesModule {}