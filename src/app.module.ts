import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { DatabaseModule } from './infrastructure/database/database.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { DomainEventBusModule } from './infrastructure/events/domain-event-bus.module';
import { HealthModule } from './infrastructure/health/health.module';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';

import { AuditModule } from './modules/audit/audit.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';

import { UsersModule } from './modules/identity/users/users.module';
import { AuthModule } from './modules/identity/auth/auth.module';
import { OrganizationsModule } from './modules/tenancy/organizations/organizations.module';
import { MembersModule } from './modules/tenancy/members/members.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { EventsModule } from './modules/events/events.module';
import { TemplatesModule } from './modules/events/templates/templates.module';
import { ThemesModule } from './modules/events/themes/themes.module';
import { SectionsModule } from './modules/events/sections/sections.module';
import { WebsiteBuilderModule } from './modules/website-builder/website-builder.module';
import { MediaModule } from './modules/media/media.module';
import { SeoModule } from './modules/seo/seo.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlatformDashboardModule } from './modules/platform-dashboard/platform-dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv }),
    
    // Dynamic throttling strategy for Dev vs Prod environments
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') === 'development';
        return [
          {
            ttl: 60_000,
            limit: isDev ? 1000 : 100, // Elevated limit during local dev
          },
        ];
      },
    }),

    LoggingModule,
    DatabaseModule,
    CacheModule,
    JobsModule,
    DomainEventBusModule,
    HealthModule,

    AuditModule,
    FeatureFlagsModule,

    UsersModule,
    AuthModule,
    OrganizationsModule,
    MembersModule,
    AuthorizationModule,
    EventsModule,
    TemplatesModule,
    ThemesModule,
    SectionsModule,
    WebsiteBuilderModule,
    MediaModule,
    SeoModule,
    AnalyticsModule,
    NotificationsModule,
    PlatformDashboardModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
  ],
})
export class AppModule {}