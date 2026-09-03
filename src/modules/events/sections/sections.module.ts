import {
  Module,
  forwardRef,
} from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  Section,
  SectionSchema,
} from './schemas/section.schema';

import {
  MongooseSectionRepository,
} from './repositories/section.repository';

import {
  SECTION_REPOSITORY,
} from './interfaces/section-repository.interface';

import {
  SectionsService,
} from './sections.service';

import {
  SectionsController,
} from './sections.controller';

import {
  EventsModule,
} from '../events.module';

import {
  MembersModule,
} from '../../tenancy/members/members.module';

import {
  PagesModule,
} from '../pages/pages.module';

@Module({
  imports: [
    forwardRef(
      () => EventsModule,
    ),

    forwardRef(
      () => PagesModule,
    ),

    MembersModule,

    MongooseModule.forFeature([
      {
        name: Section.name,
        schema: SectionSchema,
      },
    ]),
  ],

  controllers: [
    SectionsController,
  ],

  providers: [
    SectionsService,

    {
      provide: SECTION_REPOSITORY,
      useClass:
        MongooseSectionRepository,
    },
  ],

  exports: [
    SectionsService,
    SECTION_REPOSITORY,
  ],
})
export class SectionsModule {}