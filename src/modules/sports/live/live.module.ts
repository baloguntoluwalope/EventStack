import { Module, forwardRef } from '@nestjs/common';

import { LiveGateway } from './live.gateway';

import { MatchesModule } from '../matches/matches.module';
import { TournamentsModule } from '../tournaments/tournaments.module';

@Module({
  imports: [
    forwardRef(() => MatchesModule),
    TournamentsModule,
  ],

  providers: [
    LiveGateway,
  ],

  exports: [
    LiveGateway,
  ],
})
export class LiveModule {}