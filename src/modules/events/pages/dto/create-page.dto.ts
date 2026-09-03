import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePageDto {
  @ApiProperty({ example: 'Gallery' }) @IsNotEmpty() @IsString() title: string;

  @ApiPropertyOptional({ description: 'Auto-derived from title if omitted', example: 'gallery' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]*$/, { message: 'slug must be lowercase letters, numbers, and hyphens only' })
  slug?: string;
}