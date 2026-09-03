import { IsEnum, IsMongoId, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamSlotType } from '../schemas/fixture.schema';

export class TeamSlotDto {
  @ApiProperty({ enum: TeamSlotType }) @IsEnum(TeamSlotType) type: TeamSlotType;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() teamId?: string;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() groupId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() position?: number;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() sourceFixtureId?: string;
}