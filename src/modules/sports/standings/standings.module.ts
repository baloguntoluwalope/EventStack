import { Module, forwardRef } from '@nestjs/common';

import { StandingsService } from './standings.service';
import { StandingsController } from './standings.controller';

import { TournamentsModule } from '../tournaments/tournaments.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { MatchesModule } from '../matches/matches.module';
import { TeamsModule } from '../teams/teams.module';
import { MembersModule } from '../../tenancy/members/members.module';

@Module({
  imports: [
    TournamentsModule,
    FixturesModule,
    forwardRef(() => MatchesModule),
    TeamsModule,
    MembersModule,
  ],

  providers: [
    StandingsService,
  ],

  controllers: [
    StandingsController,
  ],

  exports: [
    StandingsService,
  ],
})
export class StandingsModule {}