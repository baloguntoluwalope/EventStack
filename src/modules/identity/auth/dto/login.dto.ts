import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'organizer@church.org' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  password: string;
}