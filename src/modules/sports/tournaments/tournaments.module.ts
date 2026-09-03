import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tournament, TournamentSchema } from './schemas/tournament.schema';
import { MongooseTournamentRepository } from './repositories/tournament.repository';
import { TOURNAMENT_REPOSITORY } from './interfaces/tournament-repository.interface';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { PublicTournamentsController } from './tournaments.controller';
import { MembersModule } from '../../tenancy/members/members.module';
import { EventsModule } from 'src/modules/events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tournament.name, schema: TournamentSchema }]),
    forwardRef(() => EventsModule),
    MembersModule,
  ],
  providers: [{ provide: TOURNAMENT_REPOSITORY, useClass: MongooseTournamentRepository }, TournamentsService],
  controllers: [TournamentsController, PublicTournamentsController],
  exports: [TournamentsService],
})
export class TournamentsModule {}