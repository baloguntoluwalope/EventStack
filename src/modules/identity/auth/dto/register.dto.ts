import { IsEmail, MinLength, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'organizer@church.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassw0rd!', minLength: 8 })
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}