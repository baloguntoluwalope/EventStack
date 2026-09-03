import {
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateBracketDto {
  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'For a 3-group tournament, qualify the top two teams from each group plus the two best third-placed teams.',
  })
  @IsOptional()
  @IsBoolean()
  bestThirdPlaced?: boolean;
}