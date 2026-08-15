import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import { MongooseEventRepository } from './repositories/event.repository';
import { EVENT_REPOSITORY } from './interfaces/event-repository.interface';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { SlugService } from '../../common/utils/slug.util';
import { MembersModule } from '../tenancy/members/members.module';
import { TemplatesModule } from './templates/templates.module';
import { SectionsModule } from './sections/sections.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    MembersModule,
    TemplatesModule,
    forwardRef(() => SectionsModule),
  ],
  providers: [{ provide: EVENT_REPOSITORY, useClass: MongooseEventRepository }, EventsService, SlugService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}