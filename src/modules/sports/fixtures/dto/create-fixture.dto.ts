import { IsEnum, IsOptional, IsMongoId, IsDateString, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FixtureStage } from '../schemas/fixture.schema';
import { TeamSlotDto } from './team-slot.dto';

export class CreateFixtureDto {
  @ApiPropertyOptional() @IsOptional() @IsMongoId() groupId?: string;
  @ApiPropertyOptional({ enum: FixtureStage }) @IsOptional() @IsEnum(FixtureStage) stage?: FixtureStage;

  @ApiProperty({ type: TeamSlotDto }) @ValidateNested() @Type(() => TeamSlotDto) homeSlot: TeamSlotDto;
  @ApiProperty({ type: TeamSlotDto }) @ValidateNested() @Type(() => TeamSlotDto) awaySlot: TeamSlotDto;

  @ApiProperty() @IsDateString() scheduledAt: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() venueAddress?: string;
}