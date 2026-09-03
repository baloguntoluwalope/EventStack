import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  MatchEventType,
} from '../schemas/match-event.schema';

export class CreateMatchEventDto {
  @ApiProperty({
    enum: MatchEventType,
  })
  @IsEnum(MatchEventType)
  type: MatchEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  playerId?: string;

  @ApiPropertyOptional({
    description:
      'Incoming player for substitution events',
  })
  @IsOptional()
  @IsMongoId()
  secondaryPlayerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  addedMinute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description:
      'Prevents duplicate creation on retry/double-tap',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description:
      'Correct an earlier event',
  })
  @IsOptional()
  @IsMongoId()
  correctsEventId?: string;
}