import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchEvent, MatchEventSchema } from './schemas/match-event.schema';
import { MongooseMatchEventRepository } from './repositories/match-event.repository';
import { MATCH_EVENT_REPOSITORY } from './interfaces/match-event-repository.interface';
import { MatchEventsService } from './match-events.service';
import { MatchEventsController } from './match-events.controller';
import { MembersModule } from '../../tenancy/members/members.module';
import { MatchesModule } from '../matches/matches.module';
import { PlayersModule } from '../players/players.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MatchEvent.name, schema: MatchEventSchema }]),
    MembersModule, MatchesModule, PlayersModule,
  ],
  providers: [{ provide: MATCH_EVENT_REPOSITORY, useClass: MongooseMatchEventRepository }, MatchEventsService],
  controllers: [MatchEventsController],
  exports: [
    MatchEventsService,
    MATCH_EVENT_REPOSITORY, // 🔑 Export the token so StatisticsModule can inject it
  ],
})
export class MatchEventsModule {}