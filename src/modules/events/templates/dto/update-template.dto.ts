import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {
  @ApiPropertyOptional({ description: 'Deactivate without deleting — hides it from the public catalog' })
  @IsOptional() @IsBoolean()
  active?: boolean;
}