import {
  Module,
} from '@nestjs/common';

import {
  StatisticsController,
} from './statistics.controller';

import { StatisticsService } from './statistics.service';

import { MatchEventsModule } from '../match-events/match-events.module';

@Module({
  imports: [
    MatchEventsModule,
  ],
  controllers: [
    StatisticsController,
  ],
  providers: [
    StatisticsService,
  ],
  exports: [
    StatisticsService,
  ],
})
export class StatisticsModule {}