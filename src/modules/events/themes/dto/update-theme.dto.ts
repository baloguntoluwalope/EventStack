import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateThemeDto } from './create-theme.dto';

export class UpdateThemeDto extends PartialType(CreateThemeDto) {
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  active?: boolean;
}