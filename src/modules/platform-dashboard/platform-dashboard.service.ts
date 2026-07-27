import { Injectable } from '@nestjs/common';
import { UsersService } from '../identity/users/users.service';
import { OrganizationsService } from '../tenancy/organizations/organizations.service';
import { EventsService } from '../events/events.service';
import { TemplatesService } from '../events/templates/templates.service';
import { ThemesService } from '../events/themes/themes.service';

export interface PlatformDashboardOverview {
  users: {
    total: number;
    platformAdmins: number;
    verified: number;
  };
  organizations: {
    total: number;
  };
  events: {
    total: number;
    byStatus: Record<string, number>;
  };
  catalog: {
    templates: number;
    themes: number;
  };
  generatedAt: string;
}

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly eventsService: EventsService,
    private readonly templatesService: TemplatesService,
    private readonly themesService: ThemesService,
  ) {}

  async getOverview(): Promise<PlatformDashboardOverview> {
    const [
      totalUsers,
      platformAdmins,
      verifiedUsers,
      totalOrganizations,
      eventsByStatus,
      totalTemplates,
      totalThemes,
    ] = await Promise.all([
      this.usersService.countAll(),
      this.usersService.countPlatformAdmins(),
      this.usersService.countVerified(),
      this.organizationsService.countAll(),
      this.eventsService.countByStatus(),
      this.templatesService.countAll(),
      this.themesService.countAll(),
    ]);

    // Typed reduction explicitly declaring accumulator and current value types
    const totalEvents = Object.values(eventsByStatus as Record<string, number>).reduce(
      (sum: number, count: number) => sum + count,
      0,
    );

    return {
      users: {
        total: totalUsers,
        platformAdmins,
        verified: verifiedUsers,
      },
      organizations: {
        total: totalOrganizations,
      },
      events: {
        total: totalEvents,
        byStatus: eventsByStatus,
      },
      catalog: {
        templates: totalTemplates,
        themes: totalThemes,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}