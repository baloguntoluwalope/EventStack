import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEventSeoDto {
  @ApiPropertyOptional({ maxLength: 60, description: 'Falls back to event title if unset' })
  @IsOptional() @IsString() @MaxLength(60)
  metaTitle?: string;

  @ApiPropertyOptional({ maxLength: 160, description: 'Falls back to an auto-generated summary if unset' })
  @IsOptional() @IsString() @MaxLength(160)
  metaDescription?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  ogImageUrl?: string;
}