import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({
    example: 'FC Agbara',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'AGB',
  })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: '#1E3A8A',
  })
  @IsOptional()
  @IsString()
  color?: string;

  /**
   * When supplied, the newly-created
   * organization team is automatically
   * registered for this tournament.
   */
  @ApiPropertyOptional({
    description:
      'Tournament to register the newly created team into',
  })
  @IsOptional()
  @IsMongoId()
  tournamentId?: string;
}