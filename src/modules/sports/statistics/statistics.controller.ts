import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { StatisticsService } from './statistics.service';

@Controller(
  'organizations/:organizationId/matches',
)
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
  ) {}

  @Get(':matchId/statistics')
  async getMatchStatistics(
    @Param('organizationId')
    organizationId: string,

    @Param('matchId')
    matchId: string,
  ) {
    return this.statisticsService.getMatchStatistics(
      matchId,
      organizationId,
    );
  }
}