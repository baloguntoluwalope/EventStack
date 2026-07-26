import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Harvest Convention' })
  @IsNotEmpty() @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'conference' })
  @IsOptional() @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Slug is auto-generated from title if omitted' })
  @IsOptional() @IsString()
  slug?: string;
}