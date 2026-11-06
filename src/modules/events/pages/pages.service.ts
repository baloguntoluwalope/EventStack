import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Logger,
} from '@nestjs/common';

import { Types } from 'mongoose';

import {
  IPageRepository,
  PAGE_REPOSITORY,
} from './interfaces/page-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import {
  SlugService,
} from '../../../common/utils/slug.util';

import {
  CreatePageDto,
} from './dto/create-page.dto';

import {
  BatchSectionPayload,
  SectionsService,
} from '../sections/sections.service';

@Injectable()
export class PagesService {
  private readonly logger =
    new Logger(PagesService.name);

  constructor(
    @Inject(PAGE_REPOSITORY)
    private readonly pageRepo: IPageRepository,

    private readonly slugService: SlugService,

    @Inject(
      forwardRef(() => SectionsService),
    )
    private readonly sectionsService: SectionsService,
  ) {}

  // =========================================================
  // ID
  // =========================================================

  private toObjectId(
    id: string,
    label: string,
  ): Types.ObjectId {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      throw new BadRequestException(
        `Invalid ${label} ID: ${id}`,
      );
    }

    return new Types.ObjectId(id);
  }

  // =========================================================
  // DOCUMENT ID
  // =========================================================

  private getDocumentId(
    value: any,
  ): string | null {
    if (!value) {
      return null;
    }

    if (
      typeof value === 'string'
    ) {
      return value;
    }

    if (
      typeof value.toHexString ===
      'function'
    ) {
      return value.toHexString();
    }

    if (
      typeof value.toString ===
      'function'
    ) {
      return value.toString();
    }

    return null;
  }

  // =========================================================
  // NORMALIZE KEY
  // =========================================================

  private normalizeKey(
    value: any,
  ): string {
    if (
      typeof value !== 'string'
    ) {
      return '';
    }

    return value
      .trim()
      .toLowerCase();
  }

  // =========================================================
  // TEMPLATE VERSION
  // =========================================================

  private getTemplateVersion(
    template: any,
  ): number {
    const rawVersion =
      Number(
        template?.version ?? 1,
      );

    if (
      Number.isInteger(
        rawVersion,
      ) &&
      rawVersion >= 1
    ) {
      return rawVersion;
    }

    return 1;
  }

  // =========================================================
  // TEMPLATE PAGE KEY
  // =========================================================

  /**
   * Stable page identity.
   *
   * Priority:
   *
   * 1. explicit page.key
   * 2. slug
   * 3. Home
   * 4. deterministic fallback
   */
  private getTemplatePageKey(
    page: any,
    index = 0,
  ): string {
    const explicitKey =
      this.normalizeKey(
        page?.key,
      );

    if (explicitKey) {
      return explicitKey;
    }

    if (
      page?.isHome === true
    ) {
      return 'home';
    }

    const slug =
      this.normalizeKey(
        page?.slug,
      );

    if (slug) {
      return slug;
    }

    const title =
      this.normalizeKey(
        page?.title,
      );

    if (title) {
      return title.replace(
        /\s+/g,
        '-',
      );
    }

    return `page-${index}`;
  }

  // =========================================================
  // TEMPLATE SECTION KEY
  // =========================================================

  /**
   * IMPORTANT:
   *
   * This MUST match SectionsService.
   *
   * Canonical identity:
   *
   *     pageKey:sectionKey
   *
   * Examples:
   *
   *     home:hero-section
   *     home:countdown-section
   *     about:about-section
   *     schedule:programme-section
   */
  private getTemplateSectionKey(
    page: any,
    section: any,
    index = 0,
  ): string {
    const pageKey =
      this.getTemplatePageKey(
        page,
      );

    const explicitKey =
      this.normalizeKey(
        section?.key,
      );

    if (explicitKey) {
      return `${pageKey}:${explicitKey}`;
    }

    const type =
      this.normalizeKey(
        section?.type,
      ) || 'section';

    const order =
      Number.isInteger(
        section?.order,
      )
        ? section.order
        : index;

    return `${pageKey}:${type}-${order}`;
  }

  // =========================================================
  // CREATE HOME
  // =========================================================

  async createHomePage(
    organizationId: string,
    eventId: string,
  ) {
    const organizationObjectId =
      this.toObjectId(
        organizationId,
        'organization',
      );

    const eventObjectId =
      this.toObjectId(
        eventId,
        'event',
      );

    return this.pageRepo.create({
      organizationId:
        organizationObjectId,

      eventId:
        eventObjectId,

      title:
        'Home',

      slug:
        '',

      order:
        0,

      isHome:
        true,

      showInNav:
        true,
    });
  }

  // =========================================================
  // ENSURE HOME
  // =========================================================

  async ensureHomePage(
    organizationId: string,
    eventId: string,
  ) {
    this.toObjectId(
      organizationId,
      'organization',
    );

    this.toObjectId(
      eventId,
      'event',
    );

    const existing =
      await this.pageRepo
        .findHomeForEvent(
          eventId,
          organizationId,
        );

    if (existing) {
      return existing;
    }

    try {
      return await this.createHomePage(
        organizationId,
        eventId,
      );
    } catch (err: any) {
      /*
       * Another request may have created
       * Home at the same time.
       */
      if (
        err?.code === 11000
      ) {
        const winner =
          await this.pageRepo
            .findHomeForEvent(
              eventId,
              organizationId,
            );

        if (winner) {
          return winner;
        }
      }

      throw err;
    }
  }

  // =========================================================
  // CREATE PAGE
  // =========================================================

  async create(
    eventId: string,
    organizationId: string,
    dto: CreatePageDto & {
      order?: number;
    },
  ) {
    this.toObjectId(
      eventId,
      'event',
    );

    this.toObjectId(
      organizationId,
      'organization',
    );

    const requestedSlug =
      dto.slug ||
      dto.title;

    const slug =
      await this.slugService
        .resolveUnique(
          requestedSlug,
          async (
            candidate,
          ) =>
            !!(
              await this.pageRepo
                .findBySlugForEvent(
                  eventId,
                  candidate,
                )
            ),
        );

    /*
     * Only Home may have an empty slug.
     */
    if (
      slug === ''
    ) {
      throw new BadRequestException(
        'Only the home page may use an empty slug',
      );
    }

    const pages =
      await this.pageRepo
        .findByEventForTenant(
          eventId,
          organizationId,
        );

    const order =
      Number.isInteger(
        dto.order,
      )
        ? Number(dto.order)
        : pages.length;

    return this.pageRepo.create({
      organizationId:
        this.toObjectId(
          organizationId,
          'organization',
        ),

      eventId:
        this.toObjectId(
          eventId,
          'event',
        ),

      title:
        dto.title,

      slug,

      order,

      isHome:
        false,

      showInNav:
        true,
    });
  }

  // =========================================================
  // LIST
  // =========================================================

  listForEvent(
    eventId: string,
    organizationId: string,
  ) {
    return this.pageRepo
      .findByEventForTenant(
        eventId,
        organizationId,
      );
  }

  // =========================================================
  // FIND
  // =========================================================

  async findByIdOrThrow(
    id: string,
    organizationId: string,
  ) {
    return assertFound(
      await this.pageRepo
        .findByIdForTenant(
          id,
          organizationId,
        ),
      'Page not found',
    );
  }

  // =========================================================
  // FIND FOR EVENT
  // =========================================================

  async findByIdForTenantAndEventOrThrow(
    id: string,
    organizationId: string,
    eventId: string,
  ) {
    const page =
      await this.pageRepo
        .findByIdForTenantAndEvent(
          id,
          organizationId,
          eventId,
        );

    if (!page) {
      throw new NotFoundException(
        `Page with ID ${id} not found for this event`,
      );
    }

    return page;
  }

  // =========================================================
  // UPDATE PAGE
  // =========================================================

  async update(
    id: string,
    organizationId: string,
    data: Partial<
      CreatePageDto & {
        showInNav: boolean;
        order: number;
      }
    >,
  ) {
    const page =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    /*
     * Home always has an empty slug.
     */
    if (
      page.isHome &&
      data.slug !== undefined &&
      data.slug !== ''
    ) {
      throw new BadRequestException(
        "The home page's slug cannot be changed from empty",
      );
    }

    /*
     * Non-home pages cannot become Home
     * by setting an empty slug.
     */
    if (
      !page.isHome &&
      data.slug !== undefined &&
      data.slug === ''
    ) {
      throw new BadRequestException(
        'Only the home page may use an empty slug',
      );
    }

    return assertFound(
      await this.pageRepo.updateById(
        id,
        data as any,
      ),
      'Page not found',
    );
  }

  // =========================================================
  // STAMP TEMPLATE SOURCE
  // =========================================================

  async stampTemplateSource(
    pageId: string,
    organizationId: string,
    templateId: string,
    templatePageKey: string,
    templatePageSlug: string,
    version: number,
  ) {
    await this.findByIdOrThrow(
      pageId,
      organizationId,
    );

    this.toObjectId(
      templateId,
      'template',
    );

    if (
      !templatePageKey ||
      typeof templatePageKey !==
        'string'
    ) {
      throw new BadRequestException(
        'Template page key is required.',
      );
    }

    if (
      !Number.isInteger(version) ||
      version < 1
    ) {
      throw new BadRequestException(
        'Template version must be a positive integer.',
      );
    }

    return assertFound(
      await this.pageRepo.updateById(
        pageId,
        {
          sourceTemplateId:
            new Types.ObjectId(
              templateId,
            ),

          /*
           * Stable page identity.
           */
          sourceTemplatePageKey:
            templatePageKey
              .trim()
              .toLowerCase(),

          /*
           * Retained for backwards compatibility.
           */
          sourceTemplatePageSlug:
            templatePageSlug ??
            '',

          sourceTemplateVersion:
            version,
        } as any,
      ),
      'Page not found',
    );
  }

  // =========================================================
  // SYNC TEMPLATE PAGES
  // =========================================================

  /**
   * Synchronizes pages from a template.
   *
   * IMPORTANT:
   *
   * This method does NOT replace existing event pages.
   *
   * It:
   *
   * - ensures Home exists
   * - identifies existing template pages
   * - backfills template identity
   * - creates missing pages
   * - creates sections only for newly created pages
   *
   * Existing event content is not overwritten.
   */
  async syncNewPagesFromTemplate(
    eventId: string,
    organizationId: string,
    templateId: string,
    templatesService: any,
  ) {
    const validEventId =
      this.toObjectId(
        eventId,
        'event',
      );

    const validOrgId =
      this.toObjectId(
        organizationId,
        'organization',
      );

    const validTemplateId =
      this.toObjectId(
        templateId,
        'template',
      );

    const template =
      await templatesService
        .findByIdOrThrow(
          validTemplateId.toString(),
        );

    const defaultPages =
      Array.isArray(
        template?.defaultPages,
      )
        ? template.defaultPages
        : [];

    const templateVersion =
      this.getTemplateVersion(
        template,
      );

    /*
     * =======================================================
     * LEGACY SINGLE-PAGE TEMPLATE
     * =======================================================
     */
    if (
      defaultPages.length === 0
    ) {
      const home =
        await this.ensureHomePage(
          validOrgId.toString(),
          validEventId.toString(),
        );

      const homeId =
        this.getDocumentId(
          home?._id,
        ) ??
        this.getDocumentId(
          home?.id,
        );

      /*
       * There is no page metadata to sync
       * when the template is purely legacy.
       */
      if (!homeId) {
        throw new BadRequestException(
          'Unable to resolve Home page ID.',
        );
      }

      return [];
    }

    /*
     * =======================================================
     * ENSURE HOME
     * =======================================================
     */
    await this.ensureHomePage(
      validOrgId.toString(),
      validEventId.toString(),
    );

    const existingPages =
      await this.listForEvent(
        validEventId.toString(),
        validOrgId.toString(),
      );

    const createdPages: any[] = [];

    /*
     * Keep track of pages matched during this
     * synchronization so two template pages cannot
     * accidentally map to the same event page.
     */
    const matchedPageIds =
      new Set<string>();

    // =======================================================
    // PROCESS TEMPLATE PAGES
    // =======================================================

    for (
      let pageIndex = 0;
      pageIndex <
        defaultPages.length;
      pageIndex++
    ) {
      const pageTemplate =
        defaultPages[
          pageIndex
        ];

      const pageKey =
        this.getTemplatePageKey(
          pageTemplate,
          pageIndex,
        );

      const templateSlug =
        typeof pageTemplate?.slug ===
        'string'
          ? pageTemplate.slug.trim()
          : '';

      const isHome =
        pageTemplate?.isHome ===
          true ||
        pageKey === 'home' ||
        templateSlug === '';

      let existingPage:
        | any
        | null = null;

      // =====================================================
      // 1. SOURCE TEMPLATE PAGE KEY
      // =====================================================

      existingPage =
        existingPages.find(
          (page: any) => {
            const pageId =
              this.getDocumentId(
                page?._id,
              ) ??
              this.getDocumentId(
                page?.id,
              );

            if (
              !pageId ||
              matchedPageIds.has(
                pageId,
              )
            ) {
              return false;
            }

            const sourceKey =
              this.normalizeKey(
                page
                  ?.sourceTemplatePageKey,
              );

            return (
              sourceKey ===
              pageKey
            );
          },
        ) ?? null;

      // =====================================================
      // 2. SOURCE TEMPLATE SLUG
      // =====================================================

      if (
        !existingPage
      ) {
        existingPage =
          existingPages.find(
            (page: any) => {
              const pageId =
                this.getDocumentId(
                  page?._id,
                ) ??
                this.getDocumentId(
                  page?.id,
                );

              if (
                !pageId ||
                matchedPageIds.has(
                  pageId,
                )
              ) {
                return false;
              }

              const sourceSlug =
                this.normalizeKey(
                  page
                    ?.sourceTemplatePageSlug,
                );

              if (
                isHome &&
                sourceSlug === ''
              ) {
                return true;
              }

              return (
                sourceSlug !== '' &&
                sourceSlug ===
                  templateSlug.toLowerCase()
              );
            },
          ) ?? null;
      }

      // =====================================================
      // 3. ACTUAL PAGE SLUG
      // =====================================================

      if (
        !existingPage &&
        templateSlug
      ) {
        existingPage =
          existingPages.find(
            (page: any) => {
              const pageId =
                this.getDocumentId(
                  page?._id,
                ) ??
                this.getDocumentId(
                  page?.id,
                );

              if (
                !pageId ||
                matchedPageIds.has(
                  pageId,
                )
              ) {
                return false;
              }

              return (
                this.normalizeKey(
                  page?.slug,
                ) ===
                this.normalizeKey(
                  templateSlug,
                )
              );
            },
          ) ?? null;
      }

      // =====================================================
      // 4. HOME
      // =====================================================

      if (
        !existingPage &&
        isHome
      ) {
        existingPage =
          existingPages.find(
            (page: any) => {
              const pageId =
                this.getDocumentId(
                  page?._id,
                ) ??
                this.getDocumentId(
                  page?.id,
                );

              if (
                !pageId ||
                matchedPageIds.has(
                  pageId,
                )
              ) {
                return false;
              }

              return (
                page?.isHome ===
                true
              );
            },
          ) ?? null;
      }

      // =====================================================
      // EXISTING PAGE
      // =====================================================

      if (
        existingPage
      ) {
        const pageId =
          this.getDocumentId(
            existingPage._id,
          ) ??
          this.getDocumentId(
            existingPage.id,
          );

        if (!pageId) {
          continue;
        }

        matchedPageIds.add(
          pageId,
        );

        /*
         * Backfill stable template identity.
         *
         * This does NOT modify:
         *
         * - title
         * - slug
         * - order
         * - navigation
         *
         * unless those fields are explicitly handled
         * elsewhere.
         */
        await this.stampTemplateSource(
          pageId,
          validOrgId.toString(),
          validTemplateId.toString(),
          pageKey,
          isHome
            ? ''
            : templateSlug,
          templateVersion,
        );

        await this.pageRepo.updateById(
          pageId,
          {
            title:
              pageTemplate.title,

            slug:
              isHome
                ? ''
                : templateSlug,

            order:
              Number.isInteger(
                pageTemplate.order,
              )
                ? pageTemplate.order
                : pageIndex,

            isHome,
          } as any,
        );

        /*
         * Existing page sections are intentionally
         * NOT overwritten here.
         *
         * Template section changes are handled by
         * SectionsService.listAvailableUpdates()
         * and applyTemplateUpdate().
         */

        continue;
      }

      // =====================================================
      // NEW HOME PAGE
      // =====================================================

      if (isHome) {
        const home =
          await this.ensureHomePage(
            validOrgId.toString(),
            validEventId.toString(),
          );

        const homeId =
          this.getDocumentId(
            home?._id,
          ) ??
          this.getDocumentId(
            home?.id,
          );

        if (!homeId) {
          throw new BadRequestException(
            'Unable to resolve Home page ID.',
          );
        }

        matchedPageIds.add(
          homeId,
        );

        await this.stampTemplateSource(
          homeId,
          validOrgId.toString(),
          validTemplateId.toString(),
          pageKey,
          '',
          templateVersion,
        );

        /*
         * If Home existed, its sections are deliberately
         * not replaced.
         */
        continue;
      }

      // =====================================================
      // INVALID NON-HOME TEMPLATE PAGE
      // =====================================================

      if (!templateSlug) {
        this.logger?.warn?.(
          `Skipping template page "${pageKey}" because it has no slug.`,
        );

        continue;
      }

      // =====================================================
      // CREATE NEW PAGE
      // =====================================================

      const page =
        await this.create(
          validEventId.toString(),
          validOrgId.toString(),
          {
            title:
              pageTemplate.title,

            slug:
              templateSlug,

            order:
              Number.isInteger(
                pageTemplate.order,
              )
                ? pageTemplate.order
                : pageIndex,
          },
        );

      const pageId =
        this.getDocumentId(
          (page as any)._id,
        ) ??
        this.getDocumentId(
          (page as any).id,
        );

      if (!pageId) {
        throw new BadRequestException(
          `Unable to resolve ID for newly created page "${templateSlug}".`,
        );
      }

      matchedPageIds.add(
        pageId,
      );

      // =====================================================
      // STAMP PAGE SOURCE
      // =====================================================

      await this.stampTemplateSource(
        pageId,
        validOrgId.toString(),
        validTemplateId.toString(),
        pageKey,
        templateSlug,
        templateVersion,
      );

      // =====================================================
      // CREATE PAGE SECTIONS
      // =====================================================

      const pageSections =
        Array.isArray(
          pageTemplate.sections,
        )
          ? pageTemplate.sections
          : [];

      const batch:
        BatchSectionPayload[] =
        pageSections.map(
          (
            section: any,
            sectionIndex: number,
          ) => ({
            organizationId:
              validOrgId.toString(),

            eventId:
              validEventId.toString(),

            pageId,

            type:
              section.type,

            content:
              section.content ??
              {},

            order:
              Number.isInteger(
                section.order,
              )
                ? section.order
                : sectionIndex,

            visible:
              section.visible ??
              true,

            /*
             * Canonical:
             *
             *     pageKey:sectionKey
             */
            sourceTemplateSectionKey:
              this.getTemplateSectionKey(
                pageTemplate,
                section,
                sectionIndex,
              ),

            sourceTemplateVersion:
              templateVersion,

            sourceTemplateContentHash:
              this.getContentHash(
                section.content ??
                  {},
              ),

            customizedByOrganizer:
              false,
          }),
        );

      if (
        batch.length > 0
      ) {
        await this.sectionsService
          .createMany(
            batch,
          );
      }

      createdPages.push(
        page,
      );
    }

    return createdPages;
  }

  // =========================================================
  // DELETE
  // =========================================================

  async remove(
    id: string,
    organizationId: string,
  ) {
    const page =
      await this.findByIdOrThrow(
        id,
        organizationId,
      );

    if (
      page.isHome
    ) {
      throw new BadRequestException(
        'The home page cannot be deleted',
      );
    }

    return assertDeleted(
      await this.pageRepo
        .deleteByIdForTenant(
          id,
          organizationId,
        ),
      'Page not found',
    );
  }

  // =========================================================
  // PUBLIC PAGE
  // =========================================================

  async resolvePublic(
    eventId: string,
    slug: string,
  ) {
    if (!slug) {
      return this.pageRepo
        .findHomeForEvent(
          eventId,
        );
    }

    return this.pageRepo
      .findBySlugForEvent(
        eventId,
        slug,
      );
  }

  // =========================================================
  // CONTENT HASH
  // =========================================================

  private getContentHash(
    content: any,
  ): string {
    const canonicalize =
      (value: any): any => {
        if (
          value === null ||
          value === undefined
        ) {
          return value;
        }

        if (
          value instanceof Date
        ) {
          return value.toISOString();
        }

        if (
          typeof value ===
            'object' &&
          typeof value.toHexString ===
            'function'
        ) {
          return value.toHexString();
        }

        if (
          Array.isArray(value)
        ) {
          return value.map(
            canonicalize,
          );
        }

        if (
          typeof value ===
          'object'
        ) {
          const source =
            typeof value.toObject ===
            'function'
              ? value.toObject()
              : value;

          const result:
            Record<string, any> =
            {};

          for (
            const key of Object.keys(
              source,
            ).sort()
          ) {
            if (
              key === '_id' ||
              key === '__v' ||
              key === 'createdAt' ||
              key === 'updatedAt'
            ) {
              continue;
            }

            result[key] =
              canonicalize(
                source[key],
              );
          }

          return result;
        }

        return value;
      };

    return require('crypto')
      .createHash(
        'sha256',
      )
      .update(
        JSON.stringify(
          canonicalize(
            content ?? {},
          ),
        ),
      )
      .digest('hex');
  }
}












// import { Injectable, Inject, BadRequestException, NotFoundException, forwardRef, } from '@nestjs/common';
// import { Types } from 'mongoose';
// import { createHash } from 'crypto';
// import { IPageRepository, PAGE_REPOSITORY, } from './interfaces/page-repository.interface';
// import { assertFound, assertDeleted, } from '../../../common/utils/assert-found.util';
// import { SlugService, } from '../../../common/utils/slug.util';
// import { CreatePageDto, } from './dto/create-page.dto';
// import { BatchSectionPayload, SectionsService, } from '../sections/sections.service';

// @Injectable()
// export class PagesService {
//   constructor(
//     @Inject(PAGE_REPOSITORY)
//     private readonly pageRepo: IPageRepository,
//     private readonly slugService: SlugService,
//     @Inject(forwardRef(() => SectionsService))
//     private readonly sectionsService: SectionsService,
//   ) {}

//   // =========================================================
//   // ID VALIDATION
//   // =========================================================
//   private toObjectId(
//     id: string,
//     label: string,
//   ): Types.ObjectId {
//     if (
//       !id ||
//       !Types.ObjectId.isValid(id)
//     ) {
//       throw new BadRequestException(
//         `Invalid ${label} ID: ${id}`,
//       );
//     }

//     return new Types.ObjectId(id);
//   }

//   // =========================================================
//   // DOCUMENT ID
//   // =========================================================
//   private getDocumentId(
//     value: any,
//   ): string | null {
//     if (!value) {
//       return null;
//     }

//     if (typeof value === 'string') {
//       return value;
//     }

//     if (typeof value.toString === 'function') {
//       return value.toString();
//     }

//     return null;
//   }

//   // =========================================================
//   // TEMPLATE CONTENT HASH
//   // =========================================================
//   private canonicalize(
//     value: any,
//   ): any {
//     if (
//       value === null ||
//       value === undefined
//     ) {
//       return value;
//     }

//     if (value instanceof Date) {
//       return value.toISOString();
//     }

//     if (
//       typeof value === 'object' &&
//       typeof value.toHexString === 'function'
//     ) {
//       return value.toHexString();
//     }

//     if (Array.isArray(value)) {
//       return value.map(
//         (item) => this.canonicalize(item),
//       );
//     }

//     if (typeof value === 'object') {
//       const result: Record<string, any> = {};

//       for (
//         const key of Object.keys(value).sort()
//       ) {
//         if (
//           key === '_id' ||
//           key === '__v'
//         ) {
//           continue;
//         }

//         result[key] = this.canonicalize(
//           value[key],
//         );
//       }

//       return result;
//     }

//     return value;
//   }

//   private getContentHash(
//     content: any,
//   ): string {
//     const canonical = JSON.stringify(
//       this.canonicalize(content ?? {}),
//     );

//     return createHash('sha256')
//       .update(canonical)
//       .digest('hex');
//   }

//   // =========================================================
//   // TEMPLATE PAGE KEY
//   // =========================================================
//   private getTemplatePageKey(
//     page: any,
//   ): string {
//     if (
//       typeof page?.key === 'string' &&
//       page.key.trim()
//     ) {
//       return page.key.trim();
//     }

//     /*
//      * Existing templates use slug as their page identity.
//      *
//      * Home is represented by an empty slug.
//      */
//     if (typeof page?.slug === 'string') {
//       return page.slug.trim().toLowerCase();
//     }

//     return '';
//   }

//   // =========================================================
//   // TEMPLATE SECTION KEY
//   // =========================================================
//   private getTemplateSectionKey(
//     page: any,
//     section: any,
//     index: number,
//   ): string {
//     /*
//      * Explicit key always wins.
//      */
//     if (
//       typeof section?.key === 'string' &&
//       section.key.trim()
//     ) {
//       return section.key.trim();
//     }

//     const pageKey = this.getTemplatePageKey(
//       page,
//     );

//     const type =
//       typeof section?.type === 'string'
//         ? section.type.trim().toLowerCase()
//         : 'section';

//     const order = Number.isInteger(
//       section?.order,
//     )
//       ? section.order
//       : index;

//     /*
//      * Include the page identity in generated keys.
//      *
//      * This prevents:
//      *
//      * Home/gallery-0
//      * Schedule/gallery-0
//      *
//      * from colliding.
//      */
//     return `${pageKey || 'home'}:${type}-${order}`;
//   }

//   // =========================================================
//   // CREATE HOME PAGE
//   // =========================================================
//   async createHomePage(
//     organizationId: string,
//     eventId: string,
//   ) {
//     const organizationObjectId =
//       this.toObjectId(
//         organizationId,
//         'organization',
//       );

//     const eventObjectId =
//       this.toObjectId(
//         eventId,
//         'event',
//       );

//     return this.pageRepo.create({
//       organizationId: organizationObjectId,
//       eventId: eventObjectId,
//       title: 'Home',
//       slug: '',
//       order: 0,
//       isHome: true,
//       showInNav: true,
//     });
//   }

//   // =========================================================
//   // ENSURE HOME PAGE
//   // =========================================================
//   async ensureHomePage(
//     organizationId: string,
//     eventId: string,
//   ) {
//     this.toObjectId(
//       organizationId,
//       'organization',
//     );

//     this.toObjectId(
//       eventId,
//       'event',
//     );

//     const existing =
//       await this.pageRepo.findHomeForEvent(
//         eventId,
//         organizationId,
//       );

//     if (existing) {
//       return existing;
//     }

//     try {
//       return await this.createHomePage(
//         organizationId,
//         eventId,
//       );
//     } catch (err: any) {
//       if (err?.code === 11000) {
//         const winner =
//           await this.pageRepo.findHomeForEvent(
//             eventId,
//             organizationId,
//           );

//         if (winner) {
//           return winner;
//         }
//       }

//       throw err;
//     }
//   }

//   // =========================================================
//   // CREATE PAGE
//   // =========================================================
//   async create(
//     eventId: string,
//     organizationId: string,
//     dto: CreatePageDto & {
//       order?: number;
//     },
//   ) {
//     this.toObjectId(
//       eventId,
//       'event',
//     );

//     this.toObjectId(
//       organizationId,
//       'organization',
//     );

//     const requestedSlug =
//       dto.slug || dto.title;

//     const slug =
//       await this.slugService.resolveUnique(
//         requestedSlug,
//         async (candidate) =>
//           !!(
//             await this.pageRepo.findBySlugForEvent(
//               eventId,
//               candidate,
//             )
//           ),
//       );

//     if (slug === '') {
//       throw new BadRequestException(
//         'Only the home page may use an empty slug',
//       );
//     }

//     const pages =
//       await this.pageRepo.findByEventForTenant(
//         eventId,
//         organizationId,
//       );

//     const order = Number.isInteger(
//       dto.order,
//     )
//       ? Number(dto.order)
//       : pages.length;

//     return this.pageRepo.create({
//       organizationId: this.toObjectId(
//         organizationId,
//         'organization',
//       ),
//       eventId: this.toObjectId(
//         eventId,
//         'event',
//       ),
//       title: dto.title,
//       slug,
//       order,
//       isHome: false,
//       showInNav: true,
//     });
//   }

//   // =========================================================
//   // LIST EVENT PAGES
//   // =========================================================
//   listForEvent(
//     eventId: string,
//     organizationId: string,
//   ) {
//     return this.pageRepo.findByEventForTenant(
//       eventId,
//       organizationId,
//     );
//   }

//   // =========================================================
//   // FIND PAGE
//   // =========================================================
//   async findByIdOrThrow(
//     id: string,
//     organizationId: string,
//   ) {
//     return assertFound(
//       await this.pageRepo.findByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // FIND PAGE FOR EVENT
//   // =========================================================
//   async findByIdForTenantAndEventOrThrow(
//     id: string,
//     organizationId: string,
//     eventId: string,
//   ) {
//     const page =
//       await this.pageRepo.findByIdForTenantAndEvent(
//         id,
//         organizationId,
//         eventId,
//       );

//     if (!page) {
//       throw new NotFoundException(
//         `Page with ID ${id} not found for this event`,
//       );
//     }

//     return page;
//   }

//   // =========================================================
//   // UPDATE PAGE
//   // =========================================================
//   async update(
//     id: string,
//     organizationId: string,
//     data: Partial<
//       CreatePageDto & {
//         showInNav: boolean;
//         order: number;
//       }
//     >,
//   ) {
//     const page =
//       await this.findByIdOrThrow(
//         id,
//         organizationId,
//       );

//     if (
//       page.isHome &&
//       data.slug !== undefined &&
//       data.slug !== ''
//     ) {
//       throw new BadRequestException(
//         "The home page's slug cannot be changed from empty",
//       );
//     }

//     if (
//       !page.isHome &&
//       data.slug !== undefined &&
//       data.slug === ''
//     ) {
//       throw new BadRequestException(
//         'Only the home page may use an empty slug',
//       );
//     }

//     return assertFound(
//       await this.pageRepo.updateById(
//         id,
//         data as any,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // TEMPLATE SOURCE
//   // =========================================================
//   async stampTemplateSource(
//     pageId: string,
//     organizationId: string,
//     templateId: string,
//     templateSlug: string,
//     version: number,
//   ) {
//     await this.findByIdOrThrow(
//       pageId,
//       organizationId,
//     );

//     this.toObjectId(
//       templateId,
//       'template',
//     );

//     if (
//       !Number.isInteger(version) ||
//       version < 1
//     ) {
//       throw new BadRequestException(
//         'Template version must be a positive integer.',
//       );
//     }

//     return assertFound(
//       await this.pageRepo.updateById(
//         pageId,
//         {
//           sourceTemplateId:
//             new Types.ObjectId(
//               templateId,
//             ),
//           sourceTemplatePageSlug:
//             templateSlug ?? '',
//           sourceTemplateVersion:
//             version,
//         } as any,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // SYNC NEW PAGES FROM TEMPLATE
//   // =========================================================
//   /**
//    * Additive template synchronization.
//    *
//    * IMPORTANT:
//    *
//    * This method creates only pages that are present in the
//    * template but missing from the event.
//    *
//    * Existing event pages are never overwritten here.
//    */
//   async syncNewPagesFromTemplate(
//     eventId: string,
//     organizationId: string,
//     templateId: string,
//     templatesService: any,
//   ) {
//     const validEventId =
//       this.toObjectId(
//         eventId,
//         'event',
//       );

//     const validOrgId =
//       this.toObjectId(
//         organizationId,
//         'organization',
//       );

//     const validTemplateId =
//       this.toObjectId(
//         templateId,
//         'template',
//       );

//     const template =
//       await templatesService.findByIdOrThrow(
//         validTemplateId.toString(),
//       );

//     const defaultPages =
//       Array.isArray(
//         template?.defaultPages,
//       )
//         ? template.defaultPages
//         : [];

//     if (defaultPages.length === 0) {
//       return [];
//     }

//     await this.ensureHomePage(
//       validOrgId.toString(),
//       validEventId.toString(),
//     );

//     const existingPages =
//       await this.listForEvent(
//         validEventId.toString(),
//         validOrgId.toString(),
//       );

//     /*
//      * Identity is based on the template page source,
//      * not array position.
//      */
//     const existingSourceKeys =
//       new Set<string>();

//     for (const page of existingPages) {
//       const sourceKey =
//         this.getTemplatePageKey({
//           key: (page as any)
//             .sourceTemplatePageKey,
//           slug: (page as any)
//             .sourceTemplatePageSlug,
//         });

//       if (sourceKey) {
//         existingSourceKeys.add(
//           sourceKey,
//         );
//       }
//     }

//     /*
//      * Also use sourceTemplatePageSlug directly because that is
//      * the metadata currently stored by your schema.
//      */
//     for (const page of existingPages) {
//       const slug = (page as any)
//         .sourceTemplatePageSlug;

//       if (typeof slug === 'string') {
//         existingSourceKeys.add(
//           slug.trim().toLowerCase(),
//         );
//       }
//     }

//     const createdPages: any[] = [];

//     for (
//       let pageIndex = 0;
//       pageIndex < defaultPages.length;
//       pageIndex++
//     ) {
//       const pageTemplate =
//         defaultPages[pageIndex];

//       if (pageTemplate?.isHome) {
//         continue;
//       }

//       const templatePageSlug =
//         typeof pageTemplate?.slug === 'string'
//           ? pageTemplate.slug.trim()
//           : '';

//       if (!templatePageSlug) {
//         continue;
//       }

//       const templatePageKey =
//         this.getTemplatePageKey(
//           pageTemplate,
//         );

//       if (
//         existingSourceKeys.has(
//           templatePageKey,
//         ) ||
//         existingSourceKeys.has(
//           templatePageSlug.toLowerCase(),
//         )
//       ) {
//         continue;
//       }

//       // =====================================================
//       // CREATE PAGE
//       // =====================================================
//       const page = await this.create(
//         validEventId.toString(),
//         validOrgId.toString(),
//         {
//           title: pageTemplate.title,
//           slug: templatePageSlug,

//           /*
//            * Preserve template page order.
//            */
//           order: Number.isInteger(
//             pageTemplate.order,
//           )
//             ? pageTemplate.order
//             : pageIndex,
//         },
//       );

//       const pageId =
//         this.getDocumentId(
//           (page as any)._id,
//         ) ??
//         this.getDocumentId(
//           (page as any).id,
//         );

//       if (!pageId) {
//         throw new BadRequestException(
//           `Unable to resolve ID for newly created page "${templatePageSlug}".`,
//         );
//       }

//       // =====================================================
//       // STAMP PAGE SOURCE
//       // =====================================================
//       const templateVersion =
//         Number.isInteger(
//           template.version,
//         )
//           ? template.version
//           : 1;

//       await this.stampTemplateSource(
//         pageId,
//         validOrgId.toString(),
//         validTemplateId.toString(),
//         templatePageSlug,
//         templateVersion,
//       );

//       // =====================================================
//       // CREATE PAGE SECTIONS
//       // =====================================================
//       const pageSections =
//         Array.isArray(
//           pageTemplate.sections,
//         )
//           ? pageTemplate.sections
//           : [];

//       const batch: BatchSectionPayload[] =
//         pageSections.map(
//           (
//             section: any,
//             sectionIndex: number,
//           ) => ({
//             organizationId:
//               validOrgId.toString(),
//             eventId:
//               validEventId.toString(),
//             pageId,
//             type: section.type,
//             content:
//               section.content ?? {},
//             order: Number.isInteger(
//               section.order,
//             )
//               ? section.order
//               : sectionIndex,
//             visible: true,
//             sourceTemplateSectionKey:
//               this.getTemplateSectionKey(
//                 pageTemplate,
//                 section,
//                 sectionIndex,
//               ),
//             sourceTemplateVersion:
//               templateVersion,
//             sourceTemplateContentHash:
//               this.getContentHash(
//                 section.content ?? {},
//               ),
//             customizedByOrganizer: false,
//           }),
//         );

//       if (batch.length > 0) {
//         await this.sectionsService.createMany(
//           batch,
//         );
//       }

//       createdPages.push(page);

//       existingSourceKeys.add(
//         templatePageKey,
//       );

//       existingSourceKeys.add(
//         templatePageSlug.toLowerCase(),
//       );
//     }

//     return createdPages;
//   }

//   // =========================================================
//   // DELETE PAGE
//   // =========================================================
//   async remove(
//     id: string,
//     organizationId: string,
//   ) {
//     const page =
//       await this.findByIdOrThrow(
//         id,
//         organizationId,
//       );

//     if (page.isHome) {
//       throw new BadRequestException(
//         'The home page cannot be deleted',
//       );
//     }

//     return assertDeleted(
//       await this.pageRepo.deleteByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // PUBLIC PAGE RESOLUTION
//   // =========================================================
//   async resolvePublic(
//     eventId: string,
//     slug: string,
//   ) {
//     if (!slug) {
//       return this.pageRepo.findHomeForEvent(
//         eventId,
//       );
//     }

//     return this.pageRepo.findBySlugForEvent(
//       eventId,
//       slug,
//     );
//   }
// }


// import {
//   Injectable,
//   Inject,
//   BadRequestException,
//   NotFoundException,
//   forwardRef,
// } from '@nestjs/common';

// import {
//   Types,
// } from 'mongoose';

// import {
//   IPageRepository,
//   PAGE_REPOSITORY,
// } from './interfaces/page-repository.interface';

// import {
//   assertFound,
//   assertDeleted,
// } from '../../../common/utils/assert-found.util';

// import {
//   SlugService,
// } from '../../../common/utils/slug.util';

// import {
//   CreatePageDto,
// } from './dto/create-page.dto';

// import {
//   SectionsService,
// } from '../sections/sections.service';

// @Injectable()
// export class PagesService {
//   constructor(
//     @Inject(PAGE_REPOSITORY)
//     private readonly pageRepo: IPageRepository,

//     private readonly slugService: SlugService,

//     @Inject(forwardRef(() => SectionsService))
//     private readonly sectionsService: SectionsService,
//   ) {}

//   // =========================================================
//   // ID VALIDATION
//   // =========================================================

//   private toObjectId(
//     id: string,
//     label: string,
//   ): Types.ObjectId {
//     if (
//       !id ||
//       !Types.ObjectId.isValid(id)
//     ) {
//       throw new BadRequestException(
//         `Invalid ${label} ID: ${id}`,
//       );
//     }

//     return new Types.ObjectId(id);
//   }

//   // =========================================================
//   // CREATE HOME PAGE
//   // =========================================================

//   /**
//    * Create the mandatory Home page for an event.
//    *
//    * Home is always represented by:
//    *
//    *   slug = ''
//    *   isHome = true
//    *
//    * organizationId and eventId are converted to ObjectIds
//    * before persistence.
//    */
//   async createHomePage(
//     organizationId: string,
//     eventId: string,
//   ) {
//     const organizationObjectId =
//       this.toObjectId(
//         organizationId,
//         'organization',
//       );

//     const eventObjectId =
//       this.toObjectId(
//         eventId,
//         'event',
//       );

//     return this.pageRepo.create({
//       organizationId:
//         organizationObjectId,

//       eventId:
//         eventObjectId,

//       title: 'Home',

//       slug: '',

//       order: 0,

//       isHome: true,

//       showInNav: true,
//     });
//   }

//   // =========================================================
//   // ENSURE HOME PAGE
//   // =========================================================

//   /**
//    * Ensure that exactly one Home page exists for the event.
//    *
//    * The database unique eventId + slug index protects against
//    * concurrent creation.
//    */
//   async ensureHomePage(
//     organizationId: string,
//     eventId: string,
//   ) {
//     this.toObjectId(
//       organizationId,
//       'organization',
//     );

//     this.toObjectId(
//       eventId,
//       'event',
//     );

//     const existing =
//       await this.pageRepo.findHomeForEvent(
//         eventId,
//         organizationId,
//       );

//     if (existing) {
//       return existing;
//     }

//     try {
//       return await this.createHomePage(
//         organizationId,
//         eventId,
//       );
//     } catch (err: any) {
//       /*
//        * Another request may have created Home between
//        * the lookup and insert.
//        *
//        * E11000 is expected in that race.
//        */
//       if (
//         err?.code === 11000
//       ) {
//         const winner =
//           await this.pageRepo.findHomeForEvent(
//             eventId,
//             organizationId,
//           );

//         if (winner) {
//           return winner;
//         }
//       }

//       throw err;
//     }
//   }

//   // =========================================================
//   // CREATE NORMAL PAGE
//   // =========================================================

//   async create(
//     eventId: string,
//     organizationId: string,
//     dto: CreatePageDto,
//   ) {
//     this.toObjectId(
//       eventId,
//       'event',
//     );

//     this.toObjectId(
//       organizationId,
//       'organization',
//     );

//     const slug =
//       await this.slugService.resolveUnique(
//         dto.slug || dto.title,

//         async (candidate) =>
//           !!(
//             await this.pageRepo.findBySlugForEvent(
//               eventId,
//               candidate,
//             )
//           ),
//       );

//     /*
//      * Only Home may have an empty slug.
//      */
//     if (slug === '') {
//       throw new BadRequestException(
//         'Only the home page may use an empty slug',
//       );
//     }

//     const pages =
//       await this.pageRepo.findByEventForTenant(
//         eventId,
//         organizationId,
//       );

//     return this.pageRepo.create({
//       organizationId:
//         this.toObjectId(
//           organizationId,
//           'organization',
//         ),

//       eventId:
//         this.toObjectId(
//           eventId,
//           'event',
//         ),

//       title:
//         dto.title,

//       slug,

//       order:
//         pages.length,

//       isHome:
//         false,

//       showInNav:
//         true,
//     });
//   }

//   // =========================================================
//   // LIST EVENT PAGES
//   // =========================================================

//   listForEvent(
//     eventId: string,
//     organizationId: string,
//   ) {
//     return this.pageRepo.findByEventForTenant(
//       eventId,
//       organizationId,
//     );
//   }

//   // =========================================================
//   // FIND PAGE
//   // =========================================================

//   async findByIdOrThrow(
//     id: string,
//     organizationId: string,
//   ) {
//     return assertFound(
//       await this.pageRepo.findByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // FIND PAGE FOR EVENT
//   // =========================================================

//   async findByIdForTenantAndEventOrThrow(
//     id: string,
//     organizationId: string,
//     eventId: string,
//   ) {
//     const page =
//       await this.pageRepo.findByIdForTenantAndEvent(
//         id,
//         organizationId,
//         eventId,
//       );

//     if (!page) {
//       throw new NotFoundException(
//         `Page with ID ${id} not found for this event`,
//       );
//     }

//     return page;
//   }

//   // =========================================================
//   // UPDATE PAGE
//   // =========================================================

//   async update(
//     id: string,
//     organizationId: string,
//     data: Partial<
//       CreatePageDto & {
//         showInNav: boolean;
//         order: number;
//       }
//     >,
//   ) {
//     const page =
//       await this.findByIdOrThrow(
//         id,
//         organizationId,
//       );

//     /*
//      * Home must always retain its reserved empty slug.
//      */
//     if (
//       page.isHome &&
//       data.slug !== undefined &&
//       data.slug !== ''
//     ) {
//       throw new BadRequestException(
//         "The home page's slug cannot be changed from empty",
//       );
//     }

//     /*
//      * Non-home pages cannot be changed into Home by
//      * supplying an empty slug.
//      */
//     if (
//       !page.isHome &&
//       data.slug !== undefined &&
//       data.slug === ''
//     ) {
//       throw new BadRequestException(
//         'Only the home page may use an empty slug',
//       );
//     }

//     return assertFound(
//       await this.pageRepo.updateById(
//         id,
//         data as any,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // TEMPLATE SOURCE
//   // =========================================================

//   /**
//    * Stamp a page with the template information from which it
//    * was created.
//    *
//    * This metadata is used later to determine:
//    *
//    * - which template owns the page
//    * - which template page it came from
//    * - which template version created it
//    *
//    * IMPORTANT:
//    * This does NOT modify page content.
//    */
//   async stampTemplateSource(
//     pageId: string,
//     organizationId: string,
//     templateId: string,
//     templateSlug: string,
//     version: number,
//   ) {
//     /*
//      * Tenant-safe lookup before update.
//      */
//     await this.findByIdOrThrow(
//       pageId,
//       organizationId,
//     );

//     this.toObjectId(
//       templateId,
//       'template',
//     );

//     if (
//       !Number.isInteger(version) ||
//       version < 1
//     ) {
//       throw new BadRequestException(
//         'Template version must be a positive integer.',
//       );
//     }

//     return assertFound(
//       await this.pageRepo.updateById(
//         pageId,
//         {
//           sourceTemplateId:
//             new Types.ObjectId(templateId),

//           sourceTemplatePageSlug:
//             templateSlug ?? '',

//           sourceTemplateVersion:
//             version,
//         } as any,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // SYNC NEW PAGES FROM TEMPLATE
//   // =========================================================

//   /**
//    * Additive-only, automatic, lazy template synchronization.
//    *
//    * Called when an event is rendered.
//    *
//    * If the template contains a NEW page that does not yet exist
//    * on the event, that page is cloned into the event.
//    *
//    * Existing pages are NEVER modified.
//    *
//    * Existing page content is NEVER overwritten.
//    *
//    * Existing organizer customizations are NEVER touched.
//    *
//    * This is intentionally a one-way operation:
//    *
//    *     TEMPLATE
//    *         |
//    *         v
//    *     NEW EVENT PAGE
//    *
//    * It does NOT do:
//    *
//    *     TEMPLATE -> EXISTING EVENT PAGE
//    *
//    * That operation should be handled separately as an explicit
//    * template-update/apply flow.
//    */
//   async syncNewPagesFromTemplate(
//     eventId: string,
//     organizationId: string,
//     templateId: string,
//     templatesService: any,
//     eventTitle: string,
//   ) {
//     const template =
//       await templatesService.findByIdOrThrow(
//         templateId,
//       );

//     /*
//      * This synchronization only applies to templates that
//      * actually define pages.
//      */
//     if (
//       !template.defaultPages ||
//       template.defaultPages.length === 0
//     ) {
//       return;
//     }

//     /*
//      * Make sure Home exists before synchronizing additional
//      * pages.
//      */
//     await this.ensureHomePage(
//       organizationId,
//       eventId,
//     );

//     const existingPages =
//       await this.listForEvent(
//         eventId,
//         organizationId,
//       );

//     /*
//      * sourceTemplatePageSlug is the identity used by the
//      * current page synchronization design.
//      *
//      * We intentionally ignore null because manually-created
//      * pages have no template source.
//      */
//     const existingTemplatePageSlugs =
//       new Set(
//         existingPages
//           .map(
//             (page) =>
//               page.sourceTemplatePageSlug,
//           )
//           .filter(
//             (
//               slug,
//             ): slug is string =>
//               slug !== null &&
//               slug !== undefined,
//           ),
//       );

//     const templateVersion =
//       template.version ?? 1;

//     for (
//       const pageTemplate of
//         template.defaultPages
//     ) {
//       /*
//        * Home is mandatory and already exists.
//        *
//        * Never create another Home page.
//        */
//       if (
//         pageTemplate.isHome
//       ) {
//         continue;
//       }

//       const templatePageSlug =
//         pageTemplate.slug ?? '';

//       /*
//        * This page has already been cloned from this
//        * template page.
//        */
//       if (
//         existingTemplatePageSlugs.has(
//           templatePageSlug,
//         )
//       ) {
//         continue;
//       }

//       // =====================================================
//       // CREATE NEW PAGE
//       // =====================================================

//       const page =
//         await this.create(
//           eventId,
//           organizationId,
//           {
//             title:
//               pageTemplate.title,

//             slug:
//               templatePageSlug,
//           },
//         );

//       // =====================================================
//       // STAMP PAGE SOURCE
//       // =====================================================

//       await this.stampTemplateSource(
//         page.id,
//         organizationId,
//         templateId,
//         templatePageSlug,
//         templateVersion,
//       );

//       // =====================================================
//       // CLONE PAGE SECTIONS
//       // =====================================================

//       const pageSections =
//         pageTemplate.sections ?? [];

//       for (
//         let sectionIndex = 0;
//         sectionIndex <
//           pageSections.length;
//         sectionIndex++
//       ) {
//         const section =
//           pageSections[
//             sectionIndex
//           ];

//         /*
//          * Preserve the stable template section key.
//          *
//          * Explicit key is preferred.
//          *
//          * The fallback keeps older templates working.
//          */
//         const sourceTemplateSectionKey =
//           section.key ??
//           `${section.type}-${section.order ?? sectionIndex}`;

//         // ===================================================
//         // CREATE SECTION
//         // ===================================================

//         const created =
//           await this.sectionsService.create(
//             organizationId,
//             eventId,
//             {
//               type:
//                 section.type,

//               content:
//                 section.content ?? {},

//               pageId:
//                 page.id,
//             },
//           );

//         // ===================================================
//         // STAMP SECTION SOURCE
//         // ===================================================

//         await this.sectionsService
//           .stampTemplateSource(
//             created.id,
//             organizationId,
//             sourceTemplateSectionKey,
//             templateVersion,
//             '', // Provide contentHash as required by SectionsService implementation
//           );

//         /*
//          * stampTemplateSource() on SectionsService should
//          * leave:
//          *
//          * customizedByOrganizer = false
//          *
//          * because this section was just created from the
//          * template.
//          */
//       }

//       /*
//        * Add the newly created template page to the local
//        * identity set so duplicate work cannot happen during
//        * this same synchronization pass.
//        */
//       existingTemplatePageSlugs.add(
//         templatePageSlug,
//       );
//     }
//   }

//   // =========================================================
//   // DELETE PAGE
//   // =========================================================

//   async remove(
//     id: string,
//     organizationId: string,
//   ) {
//     const page =
//       await this.findByIdOrThrow(
//         id,
//         organizationId,
//       );

//     /*
//      * Home is mandatory.
//      */
//     if (page.isHome) {
//       throw new BadRequestException(
//         'The home page cannot be deleted',
//       );
//     }

//     return assertDeleted(
//       await this.pageRepo.deleteByIdForTenant(
//         id,
//         organizationId,
//       ),
//       'Page not found',
//     );
//   }

//   // =========================================================
//   // PUBLIC PAGE RESOLUTION
//   // =========================================================

//   async resolvePublic(
//     eventId: string,
//     slug: string,
//   ) {
//     /*
//      * Empty slug represents Home.
//      */
//     if (!slug) {
//       return this.pageRepo.findHomeForEvent(
//         eventId,
//       );
//     }

//     return this.pageRepo.findBySlugForEvent(
//       eventId,
//       slug,
//     );
//   }
// }