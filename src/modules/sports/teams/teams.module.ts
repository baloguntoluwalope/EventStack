import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Team, TeamSchema } from './schemas/team.schema';
import { TeamRegistration, TeamRegistrationSchema } from './schemas/team-registration.schema';
import { MongooseTeamRepository } from './repositories/team.repository';
import { MongooseTeamRegistrationRepository } from './repositories/team-registration.repository';
import { TEAM_REPOSITORY } from './interfaces/team-repository.interface';
import { TEAM_REGISTRATION_REPOSITORY } from './interfaces/team-registration-repository.interface';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { MembersModule } from '../../tenancy/members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: TeamRegistration.name, schema: TeamRegistrationSchema },
    ]),
    MembersModule,
  ],
  providers: [
    { provide: TEAM_REPOSITORY, useClass: MongooseTeamRepository },
    { provide: TEAM_REGISTRATION_REPOSITORY, useClass: MongooseTeamRegistrationRepository },
    TeamsService,
  ],
  controllers: [TeamsController],
  exports: [TeamsService],
})
export class TeamsModule {}