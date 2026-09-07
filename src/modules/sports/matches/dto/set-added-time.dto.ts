import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class SetAddedTimeDto {
  @ApiProperty({
    example: 5,
    description:
      'Added time for the current match period, in minutes.',
  })
  @IsInt()
  @Min(0)
  @Max(30)
  minutes: number;
}