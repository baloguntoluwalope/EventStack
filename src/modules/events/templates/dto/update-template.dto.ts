import { PartialType } from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(
  CreateTemplateDto,
) {
  /**
   * Allows a template to be hidden from the public catalog
   * without deleting it.
   */
  @ApiPropertyOptional({
    description:
      'Deactivate without deleting — hides it from the public catalog.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}