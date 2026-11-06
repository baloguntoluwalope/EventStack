import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateFormDto } from './create-form.dto';
import { FormStatus } from '../schemas/form.schema';

export class UpdateFormDto extends PartialType(CreateFormDto) {
  @ApiPropertyOptional({ enum: FormStatus }) @IsOptional() @IsEnum(FormStatus) status?: FormStatus;
}