import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../common/constants/roles.constants';
import { ASSIGNABLE_ROLES } from './invite-member.dto';

export class ChangeRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role: Role;
}