import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus } from '../schemas/match.schema';

export class TransitionMatchDto {
  @ApiProperty({ enum: MatchStatus }) @IsEnum(MatchStatus) status: MatchStatus;
}