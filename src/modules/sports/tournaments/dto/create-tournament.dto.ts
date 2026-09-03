import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  IsIn,
  IsDate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentFormat } from '../schemas/tournament.schema';
import {
  SUPPORTED_TIE_BREAK_RULES,
  KNOWN_UNSUPPORTED_RULES,
} from '../../standings/tie-break-resolver';

const ALL_ALLOWED_TIE_BREAK_RULES = [
  ...SUPPORTED_TIE_BREAK_RULES,
  ...KNOWN_UNSUPPORTED_RULES,
];

export class CreateTournamentDto {
  @ApiProperty({ example: 'Agbara Community Cup 2026' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'football' })
  @IsOptional()
  @IsString()
  sport?: string;

  @ApiPropertyOptional({ enum: TournamentFormat, example: TournamentFormat.LEAGUE })
  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @ApiPropertyOptional({ example: '2026-08-21T13:30:58.226Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-08-28T13:30:58.226Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({
    example: ['goalDifference', 'goalsFor'],
    enum: ALL_ALLOWED_TIE_BREAK_RULES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(ALL_ALLOWED_TIE_BREAK_RULES, { each: true })
  tieBreakRules?: string[];
}