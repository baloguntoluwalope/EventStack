import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlayerDto {
  @ApiProperty({ example: 'John Doe' }) @IsNotEmpty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional({ example: 10 }) @IsOptional() @IsNumber() jerseyNumber?: number;
  @ApiPropertyOptional({ example: 'Forward' }) @IsOptional() @IsString() position?: string;
}