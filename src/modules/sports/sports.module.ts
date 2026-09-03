import { Module } from '@nestjs/common';
import { TournamentsModule } from './tournaments/tournaments.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { GroupsModule } from './groups/groups.module';
import { FixturesModule } from './fixtures/fixtures.module';
import { MatchesModule } from './matches/matches.module';
import { MatchEventsModule } from './match-events/match-events.module';
import { KnockoutModule } from './knockout/knockout.module';
import { LiveModule } from './live/live.module';
import { SportsPublicModule } from './public/sports-public.module';
import {
  StatisticsModule,
} from './statistics/statistics.module';

@Module({
  imports: [TournamentsModule, TeamsModule, PlayersModule, GroupsModule, FixturesModule, MatchesModule, StatisticsModule, MatchEventsModule, KnockoutModule, LiveModule, SportsPublicModule],
})
export class SportsModule {}