import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { ApiPropertyOptional } from '@nestjs/swagger';

export class GroupQualificationRuleDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      'Number of teams that qualify automatically from this group.',
    default: 2,
  })
  @IsInt()
  @Min(0)
  teamsPerGroup: number;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Number of additional teams selected across all groups.',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalBestTeams?: number;
}

export class GenerateBracketDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      'Number of teams that qualify from every group.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  teamsPerGroup?: number;

  @ApiPropertyOptional({
    example: 0,
    description:
      'Additional best teams selected across all groups.',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalBestTeams?: number;

  /**
   * Legacy compatibility.
   *
   * For the old 3-group format:
   *
   * 2 from each group
   * +
   * 2 best third placed teams
   *
   * = 8 qualifiers.
   */
  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Legacy option for the old 3-group format. ' +
      'Ignored when explicit qualification settings are supplied.',
  })
  @IsOptional()
  @IsBoolean()
  bestThirdPlaced?: boolean;

  /**
   * Optional per-group rules.
   *
   * When provided, these take precedence over
   * teamsPerGroup.
   */
  @ApiPropertyOptional({
    type: [GroupQualificationRuleDto],
    description:
      'Optional per-group qualification rules.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupQualificationRuleDto)
  groupRules?: GroupQualificationRuleDto[];
}