import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsEnum, IsBoolean, IsNumber, ValidateIf, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FormFieldType, FormOwnerType, FormPurpose } from '../schemas/form.schema';


class FormFieldDto {
    @ApiProperty() @IsString() key: string;
    @ApiProperty() @IsString() label: string;
    @ApiProperty({enum: FormFieldType}) @IsEnum(FormFieldType) type: FormFieldType;
    @ApiPropertyOptional() @IsOptional() @IsArray() options?: string[];
    @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
    @ApiPropertyOptional() @IsOptional() @IsString() placeholder?:string;
}



class FormPriceDto{
    @ApiProperty() @IsNumber() amount: number;
    @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
}

export class CreateFormDto {
  @ApiProperty({ enum: FormOwnerType }) @IsEnum(FormOwnerType) ownerType: FormOwnerType;
  @ApiProperty() @IsString() ownerId: string;

  @ApiProperty() @IsNotEmpty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;

  @ApiPropertyOptional({ enum: FormPurpose })
  @IsOptional() @IsEnum(FormPurpose)
  purpose?: FormPurpose;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPayment?: boolean;

  @ApiPropertyOptional({ type: FormPriceDto })
  @ValidateIf((o) => o.requiresPayment === true) @ValidateNested() @Type(() => FormPriceDto)
  price?: FormPriceDto;

  @ApiPropertyOptional() @IsOptional() @IsNumber() maxSubmissions?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() closesAt?: string;
}