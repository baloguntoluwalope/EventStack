import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DefaultSectionDto {
  @ApiProperty({ example: 'hero' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ example: 0 })
  @IsNotEmpty()
  @IsNumber()
  order: number;

  @ApiPropertyOptional({ example: { title: 'Welcome' }, default: {} })
  @IsOptional()
  @IsObject()
  content?: Record<string, any> = {};
}

export class CreateTemplateDto {
  @ApiProperty({ example: 'Grace' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'grace' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'church' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: [DefaultSectionDto],
    example: [
      { type: 'hero', order: 0, content: {} },
      { type: 'countdown', order: 1, content: {} },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefaultSectionDto)
  defaultSections?: DefaultSectionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}