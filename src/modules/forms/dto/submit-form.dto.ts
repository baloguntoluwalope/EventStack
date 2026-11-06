import { IsObject, IsOptional, IsEmail, IsMongoId, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitFormDto {
  @ApiProperty({ description: "Keyed by each field's `key`" })
  @IsObject() answers!: Record<string, any>;


  @ApiPropertyOptional({ description: 'Email the submitter a copy of their answers' })
  @IsOptional() @IsBoolean() sendCopy?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsEmail() submitterEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsMongoId() shiftId?: string;
}