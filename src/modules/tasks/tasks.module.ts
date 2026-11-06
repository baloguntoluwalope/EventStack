import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { MongooseTaskRepository } from './repositories/task.repository';
import { TASK_REPOSITORY } from './interfaces/task.repository.interface';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { MembersModule } from '../tenancy/members/members.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]), MembersModule, EventsModule],
  providers: [{ provide: TASK_REPOSITORY, useClass: MongooseTaskRepository }, TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}