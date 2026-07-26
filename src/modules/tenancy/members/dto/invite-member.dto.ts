import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../common/constants/roles.constants';

export class InviteMemberDto {
  @ApiProperty({ example: 'teammate@church.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: Role, example: Role.EDITOR })
  @IsEnum(Role)
  role: Role;
}