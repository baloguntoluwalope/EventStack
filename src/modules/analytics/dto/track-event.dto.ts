import { IsEnum, IsMongoId, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnalyticsEventType } from '../schemas/analytics-event.schema';

export class TrackEventDto {
  @ApiProperty()
  @IsMongoId()
  organizationId: string;

  @ApiProperty()
  @IsMongoId()
  eventId: string;

  @ApiProperty({ enum: AnalyticsEventType })
  @IsEnum(AnalyticsEventType)
  type: AnalyticsEventType;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  meta?: Record<string, any>;
}