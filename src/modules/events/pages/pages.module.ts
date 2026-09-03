import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { forwardRef } from '@nestjs/common';
import { Page, PageSchema } from './schemas/page.schema';
import { MongoosePageRepository } from './repositories/page.repository';
import { PAGE_REPOSITORY } from './interfaces/page-repository.interface';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { MembersModule } from '../../tenancy/members/members.module';
import { SlugService } from '../../../common/utils/slug.util';
import { EventsModule } from '../events.module';
import { SectionsModule } from '../sections/sections.module';


@Module({
  imports: [
    forwardRef(() => EventsModule),
    forwardRef(() => SectionsModule),
    MembersModule,

    MongooseModule.forFeature([
      {
        name: Page.name,
        schema: PageSchema,
      },
    ]),
  ],

  controllers: [
    PagesController,
  ],

  providers: [
    PagesService,
    SlugService,

    {
      provide: PAGE_REPOSITORY,
      useClass: MongoosePageRepository,
    },
  ],

  exports: [
    PagesService,
    PAGE_REPOSITORY,
  ],
})
export class PagesModule {}