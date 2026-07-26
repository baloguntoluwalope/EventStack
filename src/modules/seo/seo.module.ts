import { Module } from '@nestjs/common';
import { SeoService } from './seo.service';
import { SeoController } from './seo.controller';
import { EventsModule } from '../events/events.module';
import { SectionsModule } from '../events/sections/sections.module';
import { MembersModule } from '../tenancy/members/members.module';

@Module({
  imports: [EventsModule, SectionsModule, MembersModule],
  providers: [SeoService],
  controllers: [SeoController],
})
export class SeoModule {}