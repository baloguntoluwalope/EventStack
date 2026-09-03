import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateTournamentDto } from './create-tournament.dto';
import { TournamentStatus } from '../schemas/tournament.schema';

export class UpdateTournamentDto extends PartialType(CreateTournamentDto) {
  @ApiPropertyOptional({ enum: TournamentStatus }) @IsOptional() @IsEnum(TournamentStatus) status?: TournamentStatus;
}