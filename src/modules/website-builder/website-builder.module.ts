import { Module } from '@nestjs/common';
import { WebsiteBuilderService } from './website-builder.service';
import { WebsiteBuilderController } from './website-builder.controller';
import { EventsModule } from '../events/events.module';
import { TemplatesModule } from '../events/templates/templates.module';
import { ThemesModule } from '../events/themes/themes.module';
import { SectionsModule } from '../events/sections/sections.module';
import { MembersModule } from '../tenancy/members/members.module';
import { OrganizationsModule } from '../tenancy/organizations/organizations.module';

@Module({
  imports: [EventsModule, TemplatesModule, ThemesModule, SectionsModule, MembersModule, OrganizationsModule],
  providers: [WebsiteBuilderService],
  controllers: [WebsiteBuilderController],
})
export class WebsiteBuilderModule {}