import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fixture, FixtureSchema } from './schemas/fixture.schema';
import { MongooseFixtureRepository } from './repositories/fixture.repository';
import { FIXTURE_REPOSITORY } from './interfaces/fixture-repository.interface';
import { FixturesService } from './fixtures.service';
import { FixturesController } from './fixtures.controller';
import { MembersModule } from '../../tenancy/members/members.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { GroupsModule } from '../groups/groups.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fixture.name, schema: FixtureSchema }]),
    MembersModule, TournamentsModule, GroupsModule, TeamsModule,
  ],
  providers: [{ provide: FIXTURE_REPOSITORY, useClass: MongooseFixtureRepository }, FixturesService],
  controllers: [FixturesController],
  exports: [FixturesService],
})
export class FixturesModule {}