import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  Type,
} from 'class-transformer';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

// =========================================================
// DEFAULT SECTION DTO
// =========================================================

export class DefaultSectionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  content?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

// =========================================================
// DEFAULT PAGE DTO
// =========================================================

export class DefaultPageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showInNav?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isHome?: boolean;

  @ApiProperty({
    type: [DefaultSectionDto],
  })
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => DefaultSectionDto)
  sections: DefaultSectionDto[];
}

// =========================================================
// CREATE TEMPLATE DTO
// =========================================================

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  // -------------------------------------------------------
  // LEGACY SECTIONS
  // -------------------------------------------------------

  @ApiPropertyOptional({
    type: [DefaultSectionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => DefaultSectionDto)
  defaultSections?: DefaultSectionDto[];

  // -------------------------------------------------------
  // PAGE-BASED TEMPLATE
  // -------------------------------------------------------

  @ApiPropertyOptional({
    type: [DefaultPageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @Type(() => DefaultPageDto)
  defaultPages?: DefaultPageDto[];
}


// import {
//   IsArray,
//   IsBoolean,
//   IsNotEmpty,
//   IsNumber,
//   IsObject,
//   IsOptional,
//   IsString,
//   ValidateNested,
// } from 'class-validator';

// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { Type } from 'class-transformer';

// // =========================================================
// // DEFAULT SECTION
// // =========================================================

// export class DefaultSectionDto {
//   @ApiProperty({
//     example: 'hero',
//   })
//   @IsNotEmpty()
//   @IsString()
//   type: string;

//   @ApiProperty({
//     example: 0,
//   })
//   @IsNotEmpty()
//   @IsNumber()
//   order: number;

//   @ApiPropertyOptional({
//     example: {
//       title: 'Welcome to our event',
//     },
//     default: {},
//   })
//   @IsOptional()
//   @IsObject()
//   content?: Record<string, any> = {};

//   /**
//    * Stable identity for this section across template versions.
//    *
//    * IMPORTANT:
//    * Do not use order as the permanent identity.
//    * Sections can be reordered without becoming a new section.
//    */
//   @ApiPropertyOptional({
//     example: 'hero-main',
//     description:
//       'Stable section key used when synchronizing template updates.',
//   })
//   @IsOptional()
//   @IsString()
//   key?: string;
// }

// // =========================================================
// // DEFAULT PAGE
// // =========================================================

// export class DefaultPageDto {
//   @ApiProperty({
//     example: 'Home',
//   })
//   @IsNotEmpty()
//   @IsString()
//   title: string;

//   @ApiProperty({
//     example: '',
//     description:
//       'Home page uses an empty slug. Other pages use their public slug.',
//   })
//   @IsString()
//   slug: string;

//   @ApiPropertyOptional({
//     example: true,
//     default: false,
//   })
//   @IsOptional()
//   @IsBoolean()
//   isHome?: boolean = false;

//   @ApiPropertyOptional({
//     type: [DefaultSectionDto],
//     example: [
//       {
//         type: 'hero',
//         order: 0,
//         key: 'hero-main',
//         content: {},
//       },
//       {
//         type: 'countdown',
//         order: 1,
//         key: 'countdown-main',
//         content: {},
//       },
//     ],
//   })
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => DefaultSectionDto)
//   sections?: DefaultSectionDto[];
// }

// // =========================================================
// // CREATE TEMPLATE
// // =========================================================

// export class CreateTemplateDto {
//   @ApiProperty({
//     example: 'Grace',
//   })
//   @IsNotEmpty()
//   @IsString()
//   name: string;

//   @ApiProperty({
//     example: 'grace',
//   })
//   @IsNotEmpty()
//   @IsString()
//   slug: string;

//   @ApiPropertyOptional({
//     example: 'church',
//   })
//   @IsOptional()
//   @IsString()
//   category?: string;

//   @ApiPropertyOptional({
//     example: 'A modern church event template.',
//   })
//   @IsOptional()
//   @IsString()
//   description?: string;

//   @ApiPropertyOptional({
//     example:
//       'https://example.com/templates/grace.png',
//   })
//   @IsOptional()
//   @IsString()
//   previewImageUrl?: string;

//   /**
//    * Legacy single-page sections.
//    *
//    * Kept for backwards compatibility with existing templates.
//    */
//   @ApiPropertyOptional({
//     type: [DefaultSectionDto],
//     example: [
//       {
//         type: 'hero',
//         order: 0,
//         key: 'hero-main',
//         content: {},
//       },
//       {
//         type: 'countdown',
//         order: 1,
//         key: 'countdown-main',
//         content: {},
//       },
//     ],
//   })
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => DefaultSectionDto)
//   defaultSections?: DefaultSectionDto[];

//   /**
//    * Multi-page template structure.
//    *
//    * Home is represented by slug = ''.
//    */
//   @ApiPropertyOptional({
//     type: [DefaultPageDto],
//     example: [
//       {
//         title: 'Home',
//         slug: '',
//         isHome: true,
//         sections: [
//           {
//             type: 'hero',
//             order: 0,
//             key: 'hero-main',
//             content: {},
//           },
//         ],
//       },
//       {
//         title: 'About',
//         slug: 'about',
//         isHome: false,
//         sections: [
//           {
//             type: 'text',
//             order: 0,
//             key: 'about-content',
//             content: {},
//           },
//         ],
//       },
//     ],
//   })
//   @IsOptional()
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => DefaultPageDto)
//   defaultPages?: DefaultPageDto[];

//   @ApiPropertyOptional({
//     default: false,
//   })
//   @IsOptional()
//   @IsBoolean()
//   isPremium?: boolean;
// }