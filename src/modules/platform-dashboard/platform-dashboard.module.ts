import { Module } from '@nestjs/common';
import { PlatformDashboardService } from './platform-dashboard.service';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { UsersModule } from '../identity/users/users.module';
import { OrganizationsModule } from '../tenancy/organizations/organizations.module';
import { EventsModule } from '../events/events.module';
import { TemplatesModule } from '../events/templates/templates.module';
import { ThemesModule } from '../events/themes/themes.module';

@Module({
  imports: [UsersModule, OrganizationsModule, EventsModule, TemplatesModule, ThemesModule],
  providers: [PlatformDashboardService],
  controllers: [PlatformDashboardController],
})
export class PlatformDashboardModule {}