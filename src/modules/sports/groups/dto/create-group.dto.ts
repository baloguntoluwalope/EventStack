import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Group A' }) @IsNotEmpty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() order?: number;
}