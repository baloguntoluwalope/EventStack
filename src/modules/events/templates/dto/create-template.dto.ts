import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Grace' })
  @IsNotEmpty() @IsString()
  name: string;

  @ApiProperty({ example: 'grace' })
  @IsNotEmpty() @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'church' })
  @IsOptional() @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: [{ type: 'hero', order: 0 }, { type: 'countdown', order: 1 }] })
  @IsOptional() @IsArray()
  defaultSections?: { type: string; order: number }[];

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  isPremium?: boolean;
}