import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { Types } from 'mongoose';

import type {
  ITemplateRepository,
} from './interfaces/template-repository.interface';

import {
  TEMPLATE_REPOSITORY,
} from './interfaces/template-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import {
  CreateTemplateDto,
} from './dto/create-template.dto';

import {
  UpdateTemplateDto,
} from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger =
    new Logger(TemplatesService.name);

  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templateRepo:
      ITemplateRepository,
  ) {}

  // =========================================================
  // ID VALIDATION
  // =========================================================

  private validateId(
    id: string,
  ): string {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      throw new BadRequestException(
        `Invalid Template ID format: ${id}`,
      );
    }

    return id;
  }

  // =========================================================
  // CANONICALIZE
  // =========================================================

  /**
   * Deep canonicalization.
   *
   * This is important for template comparison.
   *
   * JSON.stringify with an array replacer only controls
   * the top-level keys. It does NOT recursively sort
   * nested objects.
   *
   * This function sorts every object at every depth.
   */
  private canonicalize(
    value: any,
  ): any {
    if (
      value === null ||
      value === undefined
    ) {
      return value;
    }

    if (
      typeof value !== 'object'
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(
        (item) =>
          this.canonicalize(item),
      );
    }

    const plain =
      typeof value.toObject ===
      'function'
        ? value.toObject()
        : value;

    const result:
      Record<string, any> = {};

    Object.keys(plain)
      .filter(
        (key) =>
          key !== '_id' &&
          key !== '__v' &&
          key !== 'createdAt' &&
          key !== 'updatedAt',
      )
      .sort()
      .forEach((key) => {
        result[key] =
          this.canonicalize(
            plain[key],
          );
      });

    return result;
  }

  private isSameStructure(
    a: any,
    b: any,
  ): boolean {
    return (
      JSON.stringify(
        this.canonicalize(a),
      ) ===
      JSON.stringify(
        this.canonicalize(b),
      )
    );
  }

  // =========================================================
  // NORMALIZE SECTION KEY
  // =========================================================

  private normalizeSection(
    section: any,
    pageKey: string,
    index: number,
  ) {
    const type =
      typeof section.type ===
      'string'
        ? section.type.trim()
        : section.type;

    let key =
      typeof section.key ===
      'string'
        ? section.key.trim()
        : section.key;

    /**
     * Backwards compatibility.
     *
     * Existing templates that don't have keys
     * receive a deterministic key.
     *
     * New templates should always explicitly
     * provide a key.
     */
    if (!key) {
      key =
        `${pageKey}.${type}.${index}`;
    }

    return {
      type,

      key,

      order:
        section.order ??
        index,

      content:
        section.content ?? {},

      visible:
        section.visible ??
        true,
    };
  }

  // =========================================================
  // NORMALIZE PAGE
  // =========================================================

  private normalizePage(
    page: any,
    index: number,
  ) {
    let key =
      typeof page.key ===
      'string'
        ? page.key.trim()
        : page.key;

    const slug =
      typeof page.slug ===
      'string'
        ? page.slug.trim()
        : '';

    const isHome =
      page.isHome ??
      false;

    /**
     * Backwards compatibility for old
     * templates without page keys.
     */
    if (!key) {
      if (isHome) {
        key = 'home';
      } else if (slug) {
        key = slug;
      } else {
        key =
          `page-${index + 1}`;
      }
    }

    const sections =
      Array.isArray(
        page.sections,
      )
        ? page.sections.map(
            (
              section: any,
              sectionIndex: number,
            ) =>
              this.normalizeSection(
                section,
                key,
                sectionIndex,
              ),
          )
        : [];

    return {
      key,

      title:
        typeof page.title ===
        'string'
          ? page.title.trim()
          : page.title,

      slug:
        isHome
          ? ''
          : slug,

      order:
        page.order ??
        index,

      showInNav:
        page.showInNav ??
        true,

      isHome,

      sections,
    };
  }

  // =========================================================
  // NORMALIZE DEFAULT PAGES
  // =========================================================

  private normalizeDefaultPages(
    pages?: any[],
  ) {
    if (!pages) {
      return undefined;
    }

    return pages.map(
      (page, index) =>
        this.normalizePage(
          page,
          index,
        ),
    );
  }

  // =========================================================
  // NORMALIZE DEFAULT SECTIONS
  // =========================================================

  private normalizeDefaultSections(
    sections?: any[],
  ) {
    if (!sections) {
      return undefined;
    }

    return sections.map(
      (section, index) =>
        this.normalizeSection(
          section,
          'home',
          index,
        ),
    );
  }

  // =========================================================
  // NORMALIZE CREATE
  // =========================================================

  private normalizeCreatePayload(
    dto: CreateTemplateDto,
  ) {
    return {
      ...dto,

      defaultPages:
        this.normalizeDefaultPages(
          dto.defaultPages,
        ),

      defaultSections:
        this.normalizeDefaultSections(
          dto.defaultSections,
        ),
    };
  }

  // =========================================================
  // NORMALIZE UPDATE
  // =========================================================

  private normalizeUpdatePayload(
    dto: UpdateTemplateDto,
  ) {
    const {
      defaultPages,
      defaultSections,
      ...rest
    } = dto;

    return {
      ...rest,

      ...(defaultPages !== undefined
        ? {
            defaultPages:
              this.normalizeDefaultPages(
                defaultPages,
              ),
          }
        : {}),

      ...(defaultSections !== undefined
        ? {
            defaultSections:
              this.normalizeDefaultSections(
                defaultSections,
              ),
          }
        : {}),
    };
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    dto: CreateTemplateDto,
  ) {
    try {
      const payload =
        this.normalizeCreatePayload(
          dto,
        );

      return await this.templateRepo.create(
        {
          ...payload,
          version: 1,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to create template: ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

  // =========================================================
  // FIND
  // =========================================================

  async findByIdOrThrow(
    id: string,
  ) {
    const validId =
      this.validateId(id);

    const template =
      await this.templateRepo.findById(
        validId,
      );

    return assertFound(
      template,
      'Template not found',
    );
  }

  // =========================================================
  // PUBLIC CATALOG
  // =========================================================

  async list(
    category?: string,
  ) {
    try {
      const filter =
        category
          ? {
              category,
              active: true,
            }
          : {
              active: true,
            };

      return await this.templateRepo.findMany(
        filter,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to list active templates: ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

  // =========================================================
  // ADMIN LIST
  // =========================================================

  async listAllForAdmin(
    category?: string,
  ) {
    try {
      const filter =
        category
          ? {
              category,
            }
          : {};

      return await this.templateRepo.findMany(
        filter,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to list admin templates: ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(
    id: string,
    dto: UpdateTemplateDto,
  ) {
    try {
      const validId =
        this.validateId(id);

      const existing =
        await this.findByIdOrThrow(
          validId,
        );

      const normalized =
        this.normalizeUpdatePayload(
          dto,
        );

      const existingDoc =
        typeof (
          existing as any
        ).toObject ===
        'function'
          ? (
              existing as any
            ).toObject()
          : existing;

      // -----------------------------------------------------
      // STRUCTURAL CHANGE DETECTION
      // -----------------------------------------------------

      const pagesChanged =
        normalized.defaultPages !==
          undefined &&
        !this.isSameStructure(
          normalized.defaultPages,
          existingDoc.defaultPages ??
            [],
        );

      const legacySectionsChanged =
        normalized.defaultSections !==
          undefined &&
        !this.isSameStructure(
          normalized.defaultSections,
          existingDoc.defaultSections ??
            [],
        );

      const structureChanged =
        pagesChanged ||
        legacySectionsChanged;

      // -----------------------------------------------------
      // VERSION
      // -----------------------------------------------------

      const currentVersion =
        Number(
          existingDoc.version ?? 1,
        );

      const nextVersion =
        structureChanged
          ? currentVersion + 1
          : currentVersion;

      // -----------------------------------------------------
      // UPDATE
      // -----------------------------------------------------

      const updateData = {
        ...normalized,
        version: nextVersion,
      };

      const updated =
        await this.templateRepo.updateById(
          validId,
          updateData,
        );

      assertFound(
        updated,
        'Template not found',
      );

      this.logger.log(
        [
          `Template updated: ${validId}`,
          `pagesChanged=${pagesChanged}`,
          `sectionsChanged=${legacySectionsChanged}`,
          `version=${nextVersion}`,
        ].join(' | '),
      );

      return await this.findByIdOrThrow(
        validId,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to update template: ${err.message}`,
        err.stack,
      );

      throw err;
    }
  }

  // =========================================================
  // REMOVE
  // =========================================================

  async remove(
    id: string,
  ) {
    const validId =
      this.validateId(id);

    return assertDeleted(
      await this.templateRepo.deleteById(
        validId,
      ),
      'Template not found',
    );
  }

  // =========================================================
  // COUNT
  // =========================================================

  async countAll() {
    try {
      if (
        typeof this.templateRepo
          .count === 'function'
      ) {
        return await this.templateRepo.count();
      }

      return 0;
    } catch (err: any) {
      this.logger.error(
        `Failed to count templates: ${err.message}`,
        err.stack,
      );

      return 0;
    }
  }
}


// import {
//   Injectable,
//   Inject,
//   BadRequestException,
//   Logger,
// } from '@nestjs/common';

// import { Types } from 'mongoose';

// import type {
//   ITemplateRepository,
// } from './interfaces/template-repository.interface';

// import {
//   TEMPLATE_REPOSITORY,
// } from './interfaces/template-repository.interface';

// import {
//   assertFound,
//   assertDeleted,
// } from '../../../common/utils/assert-found.util';

// import {
//   CreateTemplateDto,
// } from './dto/create-template.dto';

// import {
//   UpdateTemplateDto,
// } from './dto/update-template.dto';

// @Injectable()
// export class TemplatesService {
//   private readonly logger =
//     new Logger(TemplatesService.name);

//   constructor(
//     @Inject(TEMPLATE_REPOSITORY)
//     private readonly templateRepo: ITemplateRepository,
//   ) {}

//   // =========================================================
//   // ID VALIDATION
//   // =========================================================

//   private validateId(id: string): string {
//     if (
//       !id ||
//       !Types.ObjectId.isValid(id)
//     ) {
//       throw new BadRequestException(
//         `Invalid Template ID format: ${id}`,
//       );
//     }

//     return id;
//   }

//   // =========================================================
//   // NORMALIZE TEMPLATE PAGES
//   // =========================================================

//   private normalizeDefaultPages(
//     pages?: CreateTemplateDto['defaultPages'],
//   ) {
//     if (!pages) {
//       return undefined;
//     }

//     return pages.map((page) => ({
//       ...page,
//       title: typeof page.title === 'string' ? page.title.trim() : page.title,
//       slug: typeof page.slug === 'string' ? page.slug.trim() : page.slug,
//       isHome: page.isHome ?? false,
//       sections:
//         page.sections?.map((section) => ({
//           ...section,
//           type: typeof section.type === 'string' ? section.type.trim() : section.type,
//           ...(section.key !== undefined ? { key: typeof section.key === 'string' ? section.key.trim() : section.key } : {}),
//           content: section.content ?? {},
//         })) ?? [],
//     }));
//   }

//   // =========================================================
//   // NORMALIZE DEFAULT SECTIONS
//   // =========================================================

//   private normalizeDefaultSections(
//     sections?: CreateTemplateDto['defaultSections'],
//   ) {
//     if (!sections) {
//       return undefined;
//     }

//     return sections.map((section) => ({
//       ...section,
//       type: typeof section.type === 'string' ? section.type.trim() : section.type,
//       ...(section.key !== undefined ? { key: typeof section.key === 'string' ? section.key.trim() : section.key } : {}),
//       content: section.content ?? {},
//     }));
//   }

//   // =========================================================
//   // NORMALIZE CREATE PAYLOAD
//   // =========================================================

//   private normalizeCreatePayload(
//     dto: CreateTemplateDto,
//   ) {
//     return {
//       ...dto,
//       defaultPages: this.normalizeDefaultPages(dto.defaultPages),
//       defaultSections: this.normalizeDefaultSections(dto.defaultSections),
//     };
//   }

//   // =========================================================
//   // NORMALIZE UPDATE PAYLOAD
//   // =========================================================

//   private normalizeUpdatePayload(
//     dto: UpdateTemplateDto,
//   ) {
//     const {
//       defaultPages,
//       defaultSections,
//       ...rest
//     } = dto;

//     return {
//       ...rest,
//       ...(defaultPages !== undefined
//         ? {
//             defaultPages: this.normalizeDefaultPages(defaultPages),
//           }
//         : {}),
//       ...(defaultSections !== undefined
//         ? {
//             defaultSections: this.normalizeDefaultSections(defaultSections),
//           }
//         : {}),
//     };
//   }

//   // =========================================================
//   // HELPER: CANONICAL COMPARISON (STRIPS MONGOOSE METADATA)
//   // =========================================================

//   private canonicalize(val: any): any {
//     if (val === null || typeof val !== 'object') {
//       return val;
//     }

//     if (Array.isArray(val)) {
//       return val.map((item) => this.canonicalize(item));
//     }

//     const obj = typeof val.toObject === 'function' ? val.toObject() : val;
//     const sorted: Record<string, any> = {};

//     Object.keys(obj)
//       .filter((k) => k !== '_id' && k !== '__v')
//       .sort()
//       .forEach((key) => {
//         sorted[key] = this.canonicalize(obj[key]);
//       });

//     return sorted;
//   }

//   private isSameStructure(a: any, b: any): boolean {
//     return (
//       JSON.stringify(this.canonicalize(a)) ===
//       JSON.stringify(this.canonicalize(b))
//     );
//   }

//   // =========================================================
//   // CREATE
//   // =========================================================

//   async create(
//     dto: CreateTemplateDto,
//   ) {
//     try {
//       const payload =
//         this.normalizeCreatePayload(dto);

//       return await this.templateRepo.create({
//         ...payload,
//         version: 1,
//       });
//     } catch (err: any) {
//       this.logger.error(
//         `Failed to create template: ${err.message}`,
//         err.stack,
//       );

//       throw err;
//     }
//   }

//   // =========================================================
//   // FIND
//   // =========================================================

//   async findByIdOrThrow(
//     id: string,
//   ) {
//     const validId =
//       this.validateId(id);

//     const template =
//       await this.templateRepo.findById(
//         validId,
//       );

//     return assertFound(
//       template,
//       'Template not found',
//     );
//   }

//   // =========================================================
//   // PUBLIC CATALOG
//   // =========================================================

//   async list(
//     category?: string,
//   ) {
//     try {
//       const filter = category
//         ? {
//             category,
//             active: true,
//           }
//         : {
//             active: true,
//           };

//       return await this.templateRepo.findMany(
//         filter,
//       );
//     } catch (err: any) {
//       this.logger.error(
//         `Failed to list active templates: ${err.message}`,
//         err.stack,
//       );

//       throw err;
//     }
//   }

//   // =========================================================
//   // ADMIN LIST
//   // =========================================================

//   async listAllForAdmin(
//     category?: string,
//   ) {
//     try {
//       const filter = category
//         ? {
//             category,
//           }
//         : {};

//       return await this.templateRepo.findMany(
//         filter,
//       );
//     } catch (err: any) {
//       this.logger.error(
//         `Failed to list admin templates: ${err.message}`,
//         err.stack,
//       );

//       throw err;
//     }
//   }

//   // =========================================================
//   // UPDATE
//   // =========================================================
// async update(id: string, dto: UpdateTemplateDto) {
//   try {
//     const validId = this.validateId(id);
//     const existing = await this.findByIdOrThrow(validId);

//     // 1. Normalize update payload cleanly
//     const normalized = this.normalizeUpdatePayload(dto);
//     const existingDoc = typeof (existing as any).toObject === 'function' 
//       ? (existing as any).toObject() 
//       : existing;

//     // 2. Structural comparison check
//     const sectionsChanged =
//       normalized.defaultSections !== undefined &&
//       !this.isSameStructure(normalized.defaultSections, existingDoc.defaultSections);

//     const pagesChanged =
//       normalized.defaultPages !== undefined &&
//       !this.isSameStructure(normalized.defaultPages, existingDoc.defaultPages);

//     const structureChanged = sectionsChanged || pagesChanged;

//     const nextVersion = structureChanged
//       ? (existingDoc.version ?? 1) + 1
//       : (existingDoc.version ?? 1);

//     // 3. Construct clean plain object for update
//     const updateData = {
//       ...normalized,
//       version: nextVersion,
//     };

//     // 4. Perform direct database update
//     const updated = await this.templateRepo.updateById(validId, updateData);

//     assertFound(updated, 'Template not found');

//     // 5. Explicitly return clean updated document
//     return await this.findByIdOrThrow(validId);
//   } catch (err: any) {
//     this.logger.error(`Failed to update template: ${err.message}`, err.stack);
//     throw err;
//   }
// }
//   // =========================================================
//   // REMOVE
//   // =========================================================

//   async remove(
//     id: string,
//   ) {
//     const validId =
//       this.validateId(id);

//     return assertDeleted(
//       await this.templateRepo.deleteById(
//         validId,
//       ),
//       'Template not found',
//     );
//   }

//   // =========================================================
//   // COUNT
//   // =========================================================

//   async countAll() {
//     try {
//       if (
//         typeof this.templateRepo.count ===
//         'function'
//       ) {
//         return await this.templateRepo.count();
//       }

//       return 0;
//     } catch (err: any) {
//       this.logger.error(
//         `Failed to count templates: ${err.message}`,
//         err.stack,
//       );

//       return 0;
//     }
//   }
// }