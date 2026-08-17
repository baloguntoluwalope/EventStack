import { IsNotEmpty, IsOptional, IsString, IsMongoId, IsISO8601, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from './update-event-seo.dto';

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Harvest Convention' })
  @IsNotEmpty()
  @IsString()
  title: string; // Removed optional '?' because @IsNotEmpty() requires it

  @ApiPropertyOptional({ example: 'conference' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2027-03-15T18:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString() // Changed from @IsMongoId() if templateId can be a string slug/identifier
  templateId?: string;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.DRAFT })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}