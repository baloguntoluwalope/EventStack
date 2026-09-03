import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsMongoId } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePlayerDto } from './create-player.dto';
import { PlayerStatus } from '../schemas/player.schema';

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  @ApiPropertyOptional({ enum: PlayerStatus }) @IsOptional() @IsEnum(PlayerStatus) status?: PlayerStatus;
  @ApiPropertyOptional({ description: 'Move this player to a different team' }) @IsOptional() @IsMongoId() teamId?: string;
}