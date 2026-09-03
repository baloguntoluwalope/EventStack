import { ApiProperty } from '@nestjs/swagger';

export class PlayerMatchStatisticsDto {
  @ApiProperty()
  playerId: string;

  @ApiProperty()
  teamId: string;

  @ApiProperty()
  goals: number;

  @ApiProperty()
  assists: number;

  @ApiProperty()
  ownGoals: number;

  @ApiProperty()
  yellowCards: number;

  @ApiProperty()
  redCards: number;
}

export class TeamMatchStatisticsDto {
  @ApiProperty()
  teamId: string;

  @ApiProperty()
  goals: number;

  @ApiProperty()
  ownGoals: number;

  @ApiProperty()
  yellowCards: number;

  @ApiProperty()
  redCards: number;

  @ApiProperty()
  players: PlayerMatchStatisticsDto[];
}

export class MatchStatisticsDto {
  @ApiProperty()
  matchId: string;

  @ApiProperty({
    type: [PlayerMatchStatisticsDto],
  })
  players: PlayerMatchStatisticsDto[];

  @ApiProperty({
    type: [TeamMatchStatisticsDto],
  })
  teams: TeamMatchStatisticsDto[];
}