import { IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '../schemas/organization.schema';

class ContactDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Grace Community Church' })
  @IsNotEmpty() @IsString()
  name: string;

  @ApiProperty({ enum: OrgType })
  @IsEnum(OrgType)
  type: OrgType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ type: ContactDto })
  @IsOptional() @ValidateNested() @Type(() => ContactDto)
  contact?: ContactDto;
}