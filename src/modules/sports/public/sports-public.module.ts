import { Module } from '@nestjs/common';
import { SportsPublicController } from './sports-public.controller';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { FixturesModule } from '../fixtures/fixtures.module';
import { MatchesModule } from '../matches/matches.module';
import { StandingsModule } from '../standings/standings.module';
import { KnockoutModule } from '../knockout/knockout.module';
import { TeamsModule } from '../teams/teams.module';
import { MatchEventsModule } from '../match-events/match-events.module';
import { GroupsModule } from '../groups/groups.module';
import { PlayersModule } from '../players/players.module';
import { StatisticsModule } from '../statistics/statistics.module';


@Module({
  imports: [TournamentsModule, FixturesModule, MatchesModule, StatisticsModule, StandingsModule,PlayersModule, GroupsModule,KnockoutModule, MatchEventsModule, TeamsModule],
  controllers: [SportsPublicController],
})
export class SportsPublicModule {}