import {
  IsMongoId,
  IsOptional,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class RegisterTeamDto {
  @ApiProperty({
    description: 'Organization-level team ID',
  })
  @IsMongoId()
  teamId: string;

  @ApiPropertyOptional({
    description:
      'Optional tournament group to assign the team to',
  })
  @IsOptional()
  @IsMongoId()
  groupId?: string;
}