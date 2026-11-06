import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ApplyTemplateUpdateDto {
  @ApiPropertyOptional({
    description:
      'Set to true only after the organizer confirms replacing their customized section with the latest template content.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}