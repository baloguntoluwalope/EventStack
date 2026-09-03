import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import { MongooseGroupRepository } from './repositories/group.repository';
import { GROUP_REPOSITORY } from './interfaces/group-repository.interface';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { MembersModule } from '../../tenancy/members/members.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]), MembersModule],
  providers: [{ provide: GROUP_REPOSITORY, useClass: MongooseGroupRepository }, GroupsService],
  controllers: [GroupsController],
  exports: [GroupsService],
})
export class GroupsModule {}