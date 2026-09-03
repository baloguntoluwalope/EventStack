import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsString,
} from 'class-validator';

import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { FixtureStage } from '../../fixtures/schemas/fixture.schema';
import { TeamSlotDto } from '../../fixtures/dto/team-slot.dto';

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

  // --- Added missing properties to satisfy knockout.service.ts ---

  @ApiPropertyOptional({
    enum: FixtureStage,
    description: 'Stage where the winner of this match advances to.',
  })
  @IsOptional()
  @IsEnum(FixtureStage)
  winnerFeedsToStage?: FixtureStage | null;

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
    description: 'Stage where the loser of this match advances to (e.g., 3rd place match).',
  })
  @IsOptional()
  @IsEnum(FixtureStage)
  loserFeedsToStage?: FixtureStage | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Position in the next stage where the loser advances to.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  loserFeedsToPosition?: number | null;
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