import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '../schemas/organization.schema';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Grace Community Church' })
  @IsNotEmpty() @IsString()
  name: string;

  @ApiProperty({ enum: OrgType, example: OrgType.CHURCH })
  @IsEnum(OrgType)
  type: OrgType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  logoUrl?: string;
}