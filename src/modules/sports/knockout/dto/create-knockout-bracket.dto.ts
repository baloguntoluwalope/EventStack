import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsEnum,
  ValidateNested,
  IsOptional,
  Min,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { FixtureStage } from '../../fixtures/schemas/fixture.schema';
import { TeamSlotDto } from '../../fixtures/dto/team-slot.dto';
import { KnockoutTargetSlot } from '../schemas/knockout-match.schema';

class KnockoutMatchInputDto {
  @ApiProperty({
    enum: FixtureStage,
    example: FixtureStage.ROUND_OF_16,
  })
  @IsNotEmpty()
  @IsEnum(FixtureStage)
  stage: FixtureStage;

  @ApiProperty({
    example: 1,
    description: 'Position of this match inside the knockout stage.',
  })
  @IsInt()
  @IsPositive()
  position: number;

  @ApiProperty({
    type: TeamSlotDto,
    description: 'Source of the home team.',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TeamSlotDto)
  homeSource: TeamSlotDto;

  @ApiProperty({
    type: TeamSlotDto,
    description: 'Source of the away team.',
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TeamSlotDto)
  awaySource: TeamSlotDto;

  @ApiPropertyOptional({
    example: 1,
    description: 'Position in the next stage where the winner advances to.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  winnerFeedsToPosition?: number | null;

  @ApiPropertyOptional({
    enum: FixtureStage,
    description: 'Stage where the winner of this match advances to.',
  })
  @IsOptional()
  @IsEnum(FixtureStage)
  winnerFeedsToStage?: FixtureStage | null;

  @ApiPropertyOptional({
    enum: KnockoutTargetSlot,
    description: 'Target slot (home or away) where the winner advances to.',
  })
  @IsOptional()
  @IsEnum(KnockoutTargetSlot)
  winnerFeedsToSlot?: KnockoutTargetSlot | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Position in the next stage where the loser advances to.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  loserFeedsToPosition?: number | null;

  @ApiPropertyOptional({
    enum: FixtureStage,
    description: 'Stage where the loser of this match advances to (e.g., 3rd place match).',
  })
  @IsOptional()
  @IsEnum(FixtureStage)
  loserFeedsToStage?: FixtureStage | null;

  @ApiPropertyOptional({
    enum: KnockoutTargetSlot,
    description: 'Target slot (home or away) where the loser advances to.',
  })
  @IsOptional()
  @IsEnum(KnockoutTargetSlot)
  loserFeedsToSlot?: KnockoutTargetSlot | null;
}

export class CreateKnockoutBracketDto {
  @ApiProperty({
    type: [KnockoutMatchInputDto],
    description: 'Knockout matches that define the tournament bracket.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnockoutMatchInputDto)
  matches: KnockoutMatchInputDto[];
}

export class GroupQualificationRuleDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'Number of teams that qualify automatically from this group.',
    default: 2,
  })
  @IsInt()
  @Min(0)
  teamsPerGroup: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of additional teams selected across all groups.',
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
    description: 'Number of teams that qualify from every group.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  teamsPerGroup?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Additional best teams selected across all groups.',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalBestTeams?: number;

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

  @ApiPropertyOptional({
    type: [GroupQualificationRuleDto],
    description: 'Optional per-group qualification rules.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupQualificationRuleDto)
  groupRules?: GroupQualificationRuleDto[];
}