import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../common/constants/roles.constants';

// `as const` makes TypeScript treat this as a fixed list, not a loose array.
export const ASSIGNABLE_ROLES = [Role.ADMIN, Role.EDITOR, Role.VIEWER, Role.VOLUNTEER] as const;

export class InviteMemberDto {
  @ApiProperty({ example: 'teammate@church.org' })
  @IsEmail()
  email: string;

  // @IsIn checks the value is in the list. OWNER isn't, so owners
  // can't be created by invitation.
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role: Role;
}