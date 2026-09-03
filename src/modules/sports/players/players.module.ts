import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Player, PlayerSchema } from './schemas/player.schema';
import { MongoosePlayerRepository } from './repositories/player.repository';
import { PLAYER_REPOSITORY } from './interfaces/player-repository.interface';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { MembersModule } from '../../tenancy/members/members.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Player.name, schema: PlayerSchema }]), MembersModule, TeamsModule],
  providers: [{ provide: PLAYER_REPOSITORY, useClass: MongoosePlayerRepository }, PlayersService],
  controllers: [PlayersController],
  exports: [PlayersService],
})
export class PlayersModule {}