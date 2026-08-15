import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Section, SectionSchema } from './schemas/section.schema';
import { MongooseSectionRepository } from './repositories/section.repository';
import { SECTION_REPOSITORY } from './interfaces/section-repository.interface';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { EventsModule } from '../events.module';
import { MembersModule } from '../../tenancy/members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Section.name, schema: SectionSchema }]),
    forwardRef(() => EventsModule),
    MembersModule,
  ],
  providers: [{ provide: SECTION_REPOSITORY, useClass: MongooseSectionRepository }, SectionsService],
  controllers: [SectionsController],
  exports: [SectionsService],
})
export class SectionsModule {}