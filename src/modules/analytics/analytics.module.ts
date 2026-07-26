import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsEvent, AnalyticsEventSchema } from './schemas/analytics-event.schema';
import { MongooseAnalyticsRepository } from './repositories/analytics.repository';
import { ANALYTICS_REPOSITORY } from './interfaces/analytics-repository.interface';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { MembersModule } from '../tenancy/members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AnalyticsEvent.name, schema: AnalyticsEventSchema }]),
    MembersModule,
  ],
  providers: [{ provide: ANALYTICS_REPOSITORY, useClass: MongooseAnalyticsRepository }, AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}