import { IsEnum, IsObject, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SectionType } from '../schemas/section.schema';

export class CreateSectionDto {
  @ApiProperty({ enum: SectionType, example: SectionType.HERO })
  @IsEnum(SectionType)
  type: SectionType;

  @ApiPropertyOptional({ example: { heading: 'Welcome', imageUrl: 'https://...' } })
  @IsOptional() @IsObject()
  content?: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  visible?: boolean;
}