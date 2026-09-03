import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsISO8601,
  IsEnum,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '../schemas/event.schema';
import { TournamentFormat } from '../../sports/tournaments/schemas/tournament.schema';
import { EventStatus } from '../../../common/constants/event-status.constants';

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Harvest Convention', description: 'Event title' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'conference', description: 'Event category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2027-03-15T18:00:00.000Z', description: 'ISO event timestamp' })
  @IsOptional()
  @IsISO8601()
  eventDate?: string;

  @ApiPropertyOptional({ example: 'annual-harvest-convention' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '65f123456789abcdef012345' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.DRAFT })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ enum: EventType, default: EventType.GENERAL, description: 'General event or Sports tournament' })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  /** Sports-specific parameters */
  @ApiPropertyOptional({ example: 'football', description: 'Required when type is "sports"' })
  @IsOptional()
  @ValidateIf((o) => o.type === EventType.SPORTS)
  @IsNotEmpty()
  @IsString()
  sport?: string;

  @ApiPropertyOptional({ enum: TournamentFormat, example: TournamentFormat.LEAGUE, description: 'Tournament bracket or format type' })
  @IsOptional()
  @ValidateIf((o) => o.type === EventType.SPORTS)
  @IsEnum(TournamentFormat)
  competitionFormat?: TournamentFormat;

  @ApiPropertyOptional({ type: [String], example: ['goalDifference', 'goalsFor'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tieBreakRules?: string[];
}