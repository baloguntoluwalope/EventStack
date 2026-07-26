import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsDefined,
  IsObject,
  IsHexColor,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DesignTokensDto {
  @ApiProperty({ example: '#FF5733' })
  @IsString()
  @IsHexColor()
  primaryColor: string;

  @ApiProperty({ example: '#33FF57' })
  @IsString()
  @IsHexColor()
  secondaryColor: string;

  @ApiPropertyOptional({ example: '#FFFFFF' })
  @IsOptional()
  @IsString()
  @IsHexColor()
  backgroundColor?: string;

  @ApiProperty({ example: 'Inter, sans-serif' })
  @IsString()
  @IsNotEmpty()
  fontFamily: string;
}

export class CreateThemeDto {
  @ApiProperty({ example: 'Warm Sunrise' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'warm-sunrise' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ type: DesignTokensDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DesignTokensDto)
  tokens: DesignTokensDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;
}