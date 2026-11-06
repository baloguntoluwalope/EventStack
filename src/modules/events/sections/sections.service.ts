import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Types } from 'mongoose';

import {
  ISectionRepository,
  SECTION_REPOSITORY,
} from './interfaces/section-repository.interface';

import {
  assertFound,
  assertDeleted,
} from '../../../common/utils/assert-found.util';

import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

import { hashContent } from '../../../common/utils/content-hash.util';

import {
  EventsService,
} from '../events.service';

import {
  SectionDocument,
} from './schemas/section.schema';

import {
  PagesService,
} from '../pages/pages.service';

// =========================================================
// BATCH PAYLOAD
// =========================================================

export interface BatchSectionPayload {
  organizationId: string;
  eventId: string;

  type: string;
  content: Record<string, unknown>;

  order?: number;
  visible?: boolean;

  pageId?: string;

  sourceTemplateSectionKey?: string | null;
  sourceTemplateVersion?: number | null;
  sourceTemplateContentHash?: string | null;

  customizedByOrganizer?: boolean;
}

// =========================================================
// SERVICE
// =========================================================

@Injectable()
export class SectionsService {
  private readonly logger =
    new Logger(SectionsService.name);

  constructor(
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepo: ISectionRepository,

    @Inject(
      forwardRef(() => EventsService),
    )
    private readonly eventsService: EventsService,

    @Inject(
      forwardRef(() => PagesService),
    )
    private readonly pagesService: PagesService,
  ) {}

  // =========================================================
  // ID VALIDATION
  // =========================================================

  private toValidId(
    id: string,
    label: string,
  ): string {
    if (
      !id ||
      !Types.ObjectId.isValid(id)
    ) {
      throw new BadRequestException(
        `Invalid ${label} ID format: ${id}`,
      );
    }

    return id;
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
  // TEMPLATE VERSION
  // =========================================================

  private getTemplateVersion(
    template: any,
  ): number {
    const version =
      Number(
        template?.version ?? 1,
      );

    if (
      !Number.isInteger(version) ||
      version < 1
    ) {
      throw new BadRequestException(
        `Template "${template?.name ?? 'unknown'}" has an invalid version.`,
      );
    }

    return version;
  }

  // =========================================================
  // CANONICALIZE
  // =========================================================

  /**
   * Recursively canonicalizes a value.
   *
   * Object key order does not affect hashes.
   *
   * Mongo metadata such as:
   * - _id
   * - __v
   * - createdAt
   * - updatedAt
   *
   * is ignored.
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
      value instanceof Date
    ) {
      return value.toISOString();
    }

    if (
      typeof value === 'object' &&
      typeof value.toHexString ===
        'function'
    ) {
      return value.toHexString();
    }

    if (
      Array.isArray(value)
    ) {
      return value.map(
        (item) =>
          this.canonicalize(item),
      );
    }

    if (
      typeof value === 'object'
    ) {
      const source =
        typeof value.toObject ===
        'function'
          ? value.toObject()
          : value;

      const result: Record<
        string,
        any
      > = {};

      Object.keys(source)
        .filter(
          (key) =>
            key !== '_id' &&
            key !== '__v' &&
            key !== 'createdAt' &&
            key !== 'updatedAt',
        )
        .sort()
        .forEach(
          (key) => {
            result[key] =
              this.canonicalize(
                source[key],
              );
          },
        );

      return result;
    }

    return value;
  }

  // =========================================================
  // CONTENT HASH
  // =========================================================

  // private getContentHash(
  //   content: any,
  // ): string {
  //   const canonical =
  //     JSON.stringify(
  //       this.canonicalize(
  //         content ?? {},
  //       ),
  //     );

  //   return createHash('sha256')
  //     .update(canonical)
  //     .digest('hex');
  // }

  // =========================================================
  // CONTENT COMPARISON
  // =========================================================

  private contentMatches(
    a: any,
    b: any,
  ): boolean {
    return (
      JSON.stringify(
        this.canonicalize(
          a ?? {},
        ),
      ) ===
      JSON.stringify(
        this.canonicalize(
          b ?? {},
        ),
      )
    );
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
  // TEMPLATE PAGE KEY
  // =========================================================

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
      return title
        .replace(/\s+/g, '-');
    }

    return `page-${index}`;
  }

  // =========================================================
  // TEMPLATE SECTION KEY
  // =========================================================

  /**
   * Canonical section identity:
   *
   *     pageKey:sectionKey
   *
   * Examples:
   *
   *     home:hero-section
   *     home:countdown-section
   *     about:about-section
   *     about:speakers-section
   *     schedule:programme-section
   *
   * This is deliberately page-scoped.
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
  // TEMPLATE PAGE POOL
  // =========================================================

  private getTemplatePages(
    template: any,
  ): any[] {
    if (
      Array.isArray(
        template?.defaultPages,
      ) &&
      template.defaultPages.length
    ) {
      return template.defaultPages;
    }

    /*
     * Legacy single-page template.
     */
    if (
      Array.isArray(
        template?.defaultSections,
      )
    ) {
      return [
        {
          key: 'home',
          title: 'Home',
          slug: '',
          order: 0,
          isHome: true,
          showInNav: true,
          sections:
            template.defaultSections,
        },
      ];
    }

    return [];
  }

  // =========================================================
  // TEMPLATE SECTION POOL
  // =========================================================

  private getTemplateSectionPool(
    template: any,
  ) {
    const result: Array<{
      page: any;
      section: any;
      pageIndex: number;
      sectionIndex: number;
      pageKey: string;
      key: string;
    }> = [];

    const pages =
      this.getTemplatePages(
        template,
      );

    pages.forEach(
      (
        page,
        pageIndex,
      ) => {
        const pageKey =
          this.getTemplatePageKey(
            page,
            pageIndex,
          );

        const sections =
          Array.isArray(
            page?.sections,
          )
            ? page.sections
            : [];

        sections.forEach(
          (
            section,
            sectionIndex,
          ) => {
            result.push({
              page,
              section,
              pageIndex,
              sectionIndex,
              pageKey,
              key:
                this.getTemplateSectionKey(
                  page,
                  section,
                  sectionIndex,
                ),
            });
          },
        );
      },
    );

    return result;
  }

  // =========================================================
  // TEMPLATE SECTION MAP
  // =========================================================

  private buildTemplateSectionMap(
    template: any,
  ): Map<string, any> {
    const map =
      new Map<string, any>();

    for (
      const item of
        this.getTemplateSectionPool(
          template,
        )
    ) {
      const source = {
        ...item.section,

        __templatePage:
          item.page,

        __templatePageIndex:
          item.pageIndex,

        __templateSectionIndex:
          item.sectionIndex,

        __templatePageKey:
          item.pageKey,

        __templateSectionKey:
          item.key,
      };

      /*
       * Canonical:
       *
       * home:hero-section
       */
      map.set(
        item.key,
        source,
      );

      /*
       * Explicit raw key alias:
       *
       * hero-section
       */
      const rawKey =
        this.normalizeKey(
          item.section?.key,
        );

      if (rawKey) {
        /*
         * Only set this alias when it does not
         * already belong to another section.
         *
         * Canonical page-aware lookup always wins.
         */
        if (!map.has(rawKey)) {
          map.set(
            rawKey,
            source,
          );
        }
      }

      /*
       * Legacy generated key:
       *
       * hero-0
       *
       * This is only an alias. Actual identity
       * remains the canonical page:key.
       */
      const type =
        this.normalizeKey(
          item.section?.type,
        );

      const order =
        Number.isInteger(
          item.section?.order,
        )
          ? item.section.order
          : item.sectionIndex;

      if (type) {
        const legacyKey =
          `${type}-${order}`;

        if (!map.has(legacyKey)) {
          map.set(
            legacyKey,
            source,
          );
        }

        const pageLegacyKey =
          `${item.pageKey}:${legacyKey}`;

        if (
          !map.has(
            pageLegacyKey,
          )
        ) {
          map.set(
            pageLegacyKey,
            source,
          );
        }
      }
    }

    return map;
  }

  // =========================================================
  // RESOLVE EVENT PAGE TEMPLATE KEY
  // =========================================================

  private async resolveEventPageTemplateKey(
    section: any,
    organizationId: string,
    eventId: string,
    pageMap?: Map<string, string>,
  ): Promise<string | null> {
    const pageId =
      this.getDocumentId(
        section?.pageId,
      );

    if (!pageId) {
      /*
       * Legacy single-page section without
       * pageId.
       */
      return 'home';
    }

    if (pageMap?.has(pageId)) {
      return (
        pageMap.get(pageId) ??
        null
      );
    }

    const page =
      await this.pagesService
        .findByIdForTenantAndEventOrThrow(
          pageId,
          organizationId,
          eventId,
        );

    const pageKey =
      this.getTemplatePageKey(
        page,
        0,
      );

    if (pageMap) {
      pageMap.set(
        pageId,
        pageKey,
      );
    }

    return pageKey;
  }

  // =========================================================
  // RESOLVE TEMPLATE SECTION
  // =========================================================

  /**
   * Resolve an EVENT section to its corresponding
   * TEMPLATE section.
   *
   * Resolution priority:
   *
   * 1. Page + canonical section key
   * 2. Page + raw explicit section key
   * 3. Page + legacy type/order
   * 4. Global type/order ONLY when unique
   *
   * This prevents a section on one page from accidentally
   * resolving to a section on another page.
   */
  private async resolveTemplateSection(
    eventSection: any,
    template: any,
    templateMap: Map<string, any>,
    organizationId: string,
    eventId: string,
    pageMap?: Map<string, string>,
  ): Promise<any | null> {
    const pageKey =
      await this.resolveEventPageTemplateKey(
        eventSection,
        organizationId,
        eventId,
        pageMap,
      );

    const sourceKey =
      this.normalizeKey(
        eventSection
          ?.sourceTemplateSectionKey,
      );

    /*
     * -------------------------------------------------------
     * 1. Existing canonical key
     * -------------------------------------------------------
     */
    if (
      sourceKey &&
      sourceKey.includes(':')
    ) {
      const direct =
        templateMap.get(
          sourceKey,
        );

      if (
        direct &&
        this.normalizeKey(
          direct.__templatePageKey,
        ) === pageKey
      ) {
        return direct;
      }
    }

    /*
     * -------------------------------------------------------
     * 2. Raw explicit key
     * -------------------------------------------------------
     *
     * Example:
     *
     * event:
     *     hero-section
     *
     * template:
     *     home:hero-section
     */
    if (sourceKey) {
      const pageScoped =
        templateMap.get(
          `${pageKey}:${sourceKey}`,
        );

      if (pageScoped) {
        return pageScoped;
      }

      const raw =
        templateMap.get(
          sourceKey,
        );

      if (
        raw &&
        this.normalizeKey(
          raw.__templatePageKey,
        ) === pageKey
      ) {
        return raw;
      }
    }

    /*
     * -------------------------------------------------------
     * 3. Page + type + order
     * -------------------------------------------------------
     *
     * This is the critical legacy fallback.
     *
     * Old event sections can contain:
     *
     *     hero-0
     *
     * while the template now contains:
     *
     *     hero-section
     *
     * We therefore use the event page as part of
     * the identity.
     */
    const eventType =
      this.normalizeKey(
        eventSection?.type,
      );

    const eventOrder =
      Number.isInteger(
        eventSection?.order,
      )
        ? eventSection.order
        : null;

    if (
      eventType &&
      eventOrder !== null
    ) {
      const pageCandidates =
        this.getTemplateSectionPool(
          template,
        ).filter(
          (item) => {
            const candidateType =
              this.normalizeKey(
                item.section?.type,
              );

            const candidateOrder =
              Number.isInteger(
                item.section?.order,
              )
                ? item.section.order
                : item.sectionIndex;

            return (
              item.pageKey ===
                pageKey &&
              candidateType ===
                eventType &&
              candidateOrder ===
                eventOrder
            );
          },
        );

      if (
        pageCandidates.length === 1
      ) {
        const candidate =
          pageCandidates[0];

        return {
          ...candidate.section,

          __templatePage:
            candidate.page,

          __templatePageIndex:
            candidate.pageIndex,

          __templateSectionIndex:
            candidate.sectionIndex,

          __templatePageKey:
            candidate.pageKey,

          __templateSectionKey:
            candidate.key,
        };
      }
    }

    /*
     * -------------------------------------------------------
     * 4. Last-resort global type/order fallback
     * -------------------------------------------------------
     *
     * Only allow this when exactly ONE template section
     * matches.
     *
     * This preserves compatibility with very old data
     * while preventing ambiguous matches.
     */
    if (
      eventType &&
      eventOrder !== null
    ) {
      const candidates =
        this.getTemplateSectionPool(
          template,
        ).filter(
          (item) => {
            const candidateType =
              this.normalizeKey(
                item.section?.type,
              );

            const candidateOrder =
              Number.isInteger(
                item.section?.order,
              )
                ? item.section.order
                : item.sectionIndex;

            return (
              candidateType ===
                eventType &&
              candidateOrder ===
                eventOrder
            );
          },
        );

      if (
        candidates.length === 1
      ) {
        const candidate =
          candidates[0];

        return {
          ...candidate.section,

          __templatePage:
            candidate.page,

          __templatePageIndex:
            candidate.pageIndex,

          __templateSectionIndex:
            candidate.sectionIndex,

          __templatePageKey:
            candidate.pageKey,

          __templateSectionKey:
            candidate.key,
        };
      }
    }

    return null;
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(
    organizationId: string,
    eventId: string,
    dto: CreateSectionDto & {
      pageId?: string;
      sourceTemplateSectionKey?: string | null;
      sourceTemplateVersion?: number | null;
      sourceTemplateContentHash?: string | null;
      customizedByOrganizer?: boolean;
    },
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const pageId =
      await this.resolvePageId(
        validOrgId,
        validEventId,
        dto.pageId,
      );

    return this.sectionRepo.create({
      ...dto,

      organizationId:
        validOrgId,

      eventId:
        validEventId,

      pageId,

      content:
        dto.content ?? {},

      order:
        dto.order ?? 0,

      visible:
        dto.visible ?? true,

      sourceTemplateSectionKey:
        dto.sourceTemplateSectionKey ??
        null,

      sourceTemplateVersion:
        dto.sourceTemplateVersion ??
        null,

      sourceTemplateContentHash:
        dto.sourceTemplateContentHash ??
        null,

      customizedByOrganizer:
        dto.customizedByOrganizer ??
        false,
    });
  }

  // =========================================================
  // RESOLVE PAGE
  // =========================================================

  private async resolvePageId(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<string> {
    if (pageId) {
      const validPageId =
        this.toValidId(
          pageId,
          'page',
        );

      await this.pagesService
        .findByIdForTenantAndEventOrThrow(
          validPageId,
          organizationId,
          eventId,
        );

      return validPageId;
    }

    const home =
      await this.pagesService
        .ensureHomePage(
          organizationId,
          eventId,
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

    return homeId;
  }

  // =========================================================
  // CREATE MANY
  // =========================================================

  async createMany(
    sections: BatchSectionPayload[],
  ): Promise<SectionDocument[]> {
    if (
      !Array.isArray(sections) ||
      sections.length === 0
    ) {
      return [];
    }

    const resolved: Record<
      string,
      any
    >[] = [];

    for (
      const section of sections
    ) {
      const orgId =
        this.toValidId(
          section.organizationId,
          'organization',
        );

      const eventId =
        this.toValidId(
          section.eventId,
          'event',
        );

      const pageId =
        await this.resolvePageId(
          orgId,
          eventId,
          section.pageId,
        );

      resolved.push({
        organizationId:
          orgId,

        eventId:
          eventId,

        pageId,

        type:
          section.type,

        content:
          section.content ?? {},

        order:
          section.order ?? 0,

        visible:
          section.visible ?? true,

        sourceTemplateSectionKey:
          section
            .sourceTemplateSectionKey ??
          null,

        sourceTemplateVersion:
          section
            .sourceTemplateVersion ??
          null,

        sourceTemplateContentHash:
          section
            .sourceTemplateContentHash ??
          this.getContentHash(
            section.content ?? {},
          ),

        customizedByOrganizer:
          section
            .customizedByOrganizer ??
          false,
      });
    }

    if (
      this.sectionRepo.createMany
    ) {
      return this.sectionRepo.createMany(
        resolved,
      );
    }

    return Promise.all(
      resolved.map(
        (section) =>
          this.sectionRepo.create(
            section,
          ),
      ),
    );
  }

  // =========================================================
  // FIND BY EVENT
  // =========================================================

  async findByEvent(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ): Promise<SectionDocument[]> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const sections =
      await this.sectionRepo.findByEvent(
        validEventId,
        validOrgId,
      );

    if (!pageId) {
      return sections;
    }

    const validPageId =
      this.toValidId(
        pageId,
        'page',
      );

    await this.pagesService
      .findByIdForTenantAndEventOrThrow(
        validPageId,
        validOrgId,
        validEventId,
      );

    return sections.filter(
      (section) =>
        section.pageId &&
        String(section.pageId) ===
          validPageId,
    );
  }

  // =========================================================
  // LIST FOR EVENT
  // =========================================================

  async listForEvent(
    organizationId: string,
    eventId: string,
    pageId?: string,
  ) {
    return this.findByEvent(
      organizationId,
      eventId,
      pageId,
    );
  }

  // =========================================================
  // FIND ONE
  // =========================================================

  async findOne(
    organizationId: string,
    eventId: string,
    id: string,
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    const validSectionId =
      this.toValidId(
        id,
        'section',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const section =
      await this.sectionRepo
        .findByIdForTenantAndEvent(
          validSectionId,
          validOrgId,
          validEventId,
        );

    if (!section) {
      throw new NotFoundException(
        `Section with ID ${validSectionId} not found`,
      );
    }

    return section;
  }

  // =========================================================
  // STAMP TEMPLATE SOURCE
  // =========================================================

  async stampTemplateSource(
    sectionId: string,
    organizationId: string,
    key: string,
    version: number,
    contentHash: string,
  ) {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validSectionId =
      this.toValidId(
        sectionId,
        'section',
      );

    if (
      !key ||
      typeof key !== 'string'
    ) {
      throw new BadRequestException(
        'Template section key is required.',
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

    if (
      !contentHash ||
      typeof contentHash !== 'string'
    ) {
      throw new BadRequestException(
        'Template content hash is required.',
      );
    }

    return assertFound(
      await this.sectionRepo.updateById(
        validSectionId,
        {
          sourceTemplateSectionKey:
            key,

          sourceTemplateVersion:
            version,

          sourceTemplateContentHash:
            contentHash,
        } as any,
      ),
      'Section not found',
    );
  }

  // =========================================================
  // UPDATE ORGANIZER SECTION
  // =========================================================

  async update(
    organizationId: string,
    eventId: string,
    id: string,
    dto:
      | Partial<CreateSectionDto>
      | UpdateSectionDto
      | (Partial<CreateSectionDto> & {
          pageId?: string;
        }),
  ): Promise<SectionDocument> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    const validSectionId =
      this.toValidId(
        id,
        'section',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const existing =
      await this.sectionRepo
        .findByIdForTenantAndEvent(
          validSectionId,
          validOrgId,
          validEventId,
        );

    if (!existing) {
      throw new NotFoundException(
        `Section with ID ${validSectionId} not found for this event`,
      );
    }

    const updatePayload: Record<
      string,
      any
    > = {};

    if (
      dto.type !== undefined
    ) {
      updatePayload.type =
        dto.type;
    }

    if (
      dto.order !== undefined
    ) {
      updatePayload.order =
        dto.order;
    }

    if (
      dto.visible !== undefined
    ) {
      updatePayload.visible =
        dto.visible;
    }

    if (
      'pageId' in dto &&
      dto.pageId !== undefined
    ) {
      updatePayload.pageId =
        await this.resolvePageId(
          validOrgId,
          validEventId,
          dto.pageId,
        );
    }

    if (
      dto.content !== undefined
    ) {
      updatePayload.content =
        dto.content;

      /*
       * Organizer changed the section.
       */
      updatePayload.customizedByOrganizer =
        true;
    }

    /*
     * Never allow ordinary organizer edits
     * to rewrite template synchronization state.
     */
    delete updatePayload
      .sourceTemplateSectionKey;

    delete updatePayload
      .sourceTemplateVersion;

    delete updatePayload
      .sourceTemplateContentHash;

    return assertFound(
      await this.sectionRepo.updateById(
        validSectionId,
        updatePayload,
      ),
      'Section not found after update execution',
    );
  }

  // =========================================================
  // REORDER
  // =========================================================

  async reorder(
    organizationId: string,
    eventId: string,
    orderedIds: string[],
  ): Promise<void> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    if (
      !Array.isArray(
        orderedIds,
      )
    ) {
      throw new BadRequestException(
        'orderedIds must be an array',
      );
    }

    orderedIds.forEach(
      (id) =>
        this.toValidId(
          id,
          'section',
        ),
    );

    return this.sectionRepo.reorder(
      validOrgId,
      validEventId,
      orderedIds,
    );
  }

  // =========================================================
  // REMOVE
  // =========================================================

  async remove(
    organizationId: string,
    eventId: string,
    id: string,
  ): Promise<{
    deleted: true;
  }> {
    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const validEventId =
      this.toValidId(
        eventId,
        'event',
      );

    const validSectionId =
      this.toValidId(
        id,
        'section',
      );

    await this.eventsService
      .findByIdForTenantOrThrow(
        validEventId,
        validOrgId,
      );

    const section =
      await this.sectionRepo
        .findByIdForTenantAndEvent(
          validSectionId,
          validOrgId,
          validEventId,
        );

    if (!section) {
      throw new NotFoundException(
        `Section with ID ${validSectionId} not found for this event`,
      );
    }

    const deleted =
      await this.sectionRepo
        .deleteByIdForTenant(
          validSectionId,
          validOrgId,
        );

    return assertDeleted(
      deleted,
      'Section not found or already deleted',
    );
  }

  // =========================================================
  // AVAILABLE TEMPLATE UPDATES
  // ========================================================

async listAvailableUpdates(
  eventId: string,
  organizationId: string,
  templatesService: any,
) {
  const validEventId = this.toValidId(eventId, 'event');
  const validOrgId = this.toValidId(organizationId, 'organization');

  const event = await this.eventsService.findByIdForTenantOrThrow(
    validEventId,
    validOrgId,
  );

  // Event without a template has no updates available
  if (!event.templateId) {
    return [];
  }

  await this.pagesService.syncNewPagesFromTemplate(
    validEventId,
    validOrgId,
    event.templateId.toString(),
    templatesService,
  );

  const template = await templatesService.findByIdOrThrow(
    event.templateId.toString(),
  );

  const templateVersion = this.getTemplateVersion(template);
  const sections = await this.listForEvent(validOrgId, validEventId);
  const templateMap = this.buildTemplateSectionMap(template);

  const pageMap = new Map<string, string>();
  const updates: any[] = [];
  let loggedSample = false;

  for (const section of sections) {
    const source = await this.resolveTemplateSection(
      section,
      template,
      templateMap,
      validOrgId,
      validEventId,
      pageMap,
    );

    // Section deleted from current template - skip
    if (!source) {
      continue;
    }

    const sectionId =
      this.getDocumentId(section._id) ??
      this.getDocumentId(section.id);

    if (!sectionId) {
      continue;
    }

    // Compute canonical hash for template content
    const sourceHash = this.getContentHash(source.content ?? {});

    const storedSourceHash =
      typeof section.sourceTemplateContentHash === 'string'
        ? section.sourceTemplateContentHash.trim()
        : section.sourceTemplateContentHash ?? null;

    /*
     * -------------------------------------------------------
     * LEGACY BASELINE HANDLING
     * -------------------------------------------------------
     */
    if (!storedSourceHash) {
      const eventMatchesTemplate = this.contentMatches(
        section.content ?? {},
        source.content ?? {},
      );

      if (eventMatchesTemplate) {
        // Silently establish current template baseline
        await this.sectionRepo.updateById(sectionId, {
          sourceTemplateSectionKey: source.__templateSectionKey,
          sourceTemplateVersion: templateVersion,
          sourceTemplateContentHash: sourceHash,
        } as any);

        continue;
      }

      // If untracked legacy section was customized by organizer, ignore
      if (section.customizedByOrganizer) {
        continue;
      }

      // Untracked section differs from template -> mark baseline & skip false update
      await this.sectionRepo.updateById(sectionId, {
        sourceTemplateSectionKey: source.__templateSectionKey,
        sourceTemplateVersion: templateVersion,
        sourceTemplateContentHash: sourceHash,
      } as any);

      continue;
    }

    /*
     * -------------------------------------------------------
     * TEMPLATE CHANGE DETECTION
     * -------------------------------------------------------
     */
    const templateChanged = storedSourceHash !== sourceHash;

    if (templateChanged) {
      if (!loggedSample) {
        this.logger.debug(
          `[listAvailableUpdates] Mismatch on key '${source.__templateSectionKey}': storedHash=${storedSourceHash} vs currentHash=${sourceHash}`,
        );
        loggedSample = true;
      }

      updates.push({
        sectionId,
        type: source.type ?? section.type,
        currentType: section.type,
        currentVersion: section.sourceTemplateVersion ?? null,
        latestVersion: templateVersion,
        customizedByOrganizer: section.customizedByOrganizer ?? false,
        sourceTemplateSectionKey: source.__templateSectionKey,
        sourceTemplateContentHash: sourceHash,
        sourceTemplatePageKey: source.__templatePageKey,
        order: source.order ?? section.order,
      });
    }
  }

  this.logger.log(
    [
      'Template update check completed',
      `event=${validEventId}`,
      `template=${event.templateId}`,
      `templateVersion=${templateVersion}`,
      `sectionsChecked=${sections.length}`,
      `updates=${updates.length}`,
    ].join(' | '),
  );

  return updates;
}

/**
 * Helper: Normalizes content object keys deterministically before hashing.
 * Place this in your class to prevent false-positive hash mismatches.
 */
private getContentHash(content: Record<string, any>): string {
  return hashContent(content);
}
  // =========================================================
  // APPLY TEMPLATE UPDATE
  // =========================================================

  async applyTemplateUpdate(
    sectionId: string,
    organizationId: string,
    templatesService: any,
    options?: {
      force?: boolean;
    },
  ) {
    const validSectionId =
      this.toValidId(
        sectionId,
        'section',
      );

    const validOrgId =
      this.toValidId(
        organizationId,
        'organization',
      );

    const section =
      await assertFound(
        await this.sectionRepo
          .findByIdForTenant(
            validSectionId,
            validOrgId,
          ),
        'Section not found',
      );

    if (!section.eventId) {
      throw new BadRequestException(
        'This section is not associated with an event.',
      );
    }

    const eventId =
      section.eventId.toString();

    const event =
      await this.eventsService
        .findByIdForTenantOrThrow(
          eventId,
          validOrgId,
        );

    if (!event.templateId) {
      throw new BadRequestException(
        'This event is not using a template.',
      );
    }

    /*
     * Organizer customization protection.
     */
    if (
      section.customizedByOrganizer &&
      !options?.force
    ) {
      throw new BadRequestException(
        'This section has been customized by the organizer. Explicitly force the template update to replace the customization.',
      );
    }

    const template =
      await templatesService
        .findByIdOrThrow(
          event.templateId.toString(),
        );

    const templateVersion =
      this.getTemplateVersion(
        template,
      );

    const templateMap =
      this.buildTemplateSectionMap(
        template,
      );

    const pageMap =
      new Map<
        string,
        string
      >();

    const source =
      await this.resolveTemplateSection(
        section,
        template,
        templateMap,
        validOrgId,
        eventId,
        pageMap,
      );

    if (!source) {
      throw new BadRequestException(
        'This section no longer exists in the template.',
      );
    }

    const sourceKey =
      source.__templateSectionKey;

    const content =
      source.content ?? {};

    const contentHash =
      this.getContentHash(
        content,
      );

    /*
     * Apply ONLY this section.
     *
     * Other event sections remain untouched.
     */
    const updated =
      await this.sectionRepo
        .updateById(
          validSectionId,
          {
            type:
              source.type,

            order:
              source.order ??
              section.order,

            content,

            sourceTemplateSectionKey:
              sourceKey,

            sourceTemplateVersion:
              templateVersion,

            sourceTemplateContentHash:
              contentHash,

            customizedByOrganizer:
              false,
          },
        );

    return assertFound(
      updated,
      'Section not found',
    );
  }
}




// import {
//   Injectable,
//   Inject,
//   forwardRef,
//   Logger,
//   NotFoundException,
//   BadRequestException,
// } from '@nestjs/common';

// import { Types } from 'mongoose';

// import type {
//   ISectionRepository,
// } from './interfaces/section-repository.interface';

// import {
//   SECTION_REPOSITORY,
// } from './interfaces/section-repository.interface';

// import {
//   assertFound,
//   assertDeleted,
// } from '../../../common/utils/assert-found.util';

// import {
//   CreateSectionDto,
// } from './dto/create-section.dto';

// import {
//   UpdateSectionDto,
// } from './dto/update-section.dto';

// import {
//   EventsService,
// } from '../events.service';

// import {
//   SectionDocument,
// } from './schemas/section.schema';

// import {
//   PagesService,
// } from '../pages/pages.service';

// export interface BatchSectionPayload {
//   organizationId: string;
//   eventId: string;

//   type: string;

//   content: Record<string, unknown>;

//   order?: number;

//   visible?: boolean;

//   pageId?: string;

//   sourceTemplateSectionKey?: string | null;

//   sourceTemplateVersion?: number | null;

//   sourceTemplateContentHash?: string | null;

//   customizedByOrganizer?: boolean;
// }

// @Injectable()
// export class SectionsService {
//   private readonly logger =
//     new Logger(SectionsService.name);

//   constructor(
//     @Inject(SECTION_REPOSITORY)
//     private readonly sectionRepo:
//       ISectionRepository,

//     @Inject(
//       forwardRef(() => EventsService),
//     )
//     private readonly eventsService:
//       EventsService,

//     @Inject(
//       forwardRef(() => PagesService),
//     )
//     private readonly pagesService:
//       PagesService,
//   ) {}

//   // =========================================================
//   // VALIDATION
//   // =========================================================

//   private toValidId(
//     id: string,
//     label: string,
//   ): string {
//     if (
//       !id ||
//       !Types.ObjectId.isValid(id)
//     ) {
//       throw new BadRequestException(
//         `Invalid ${label} ID format: ${id}`,
//       );
//     }

//     return id;
//   }

//   // =========================================================
//   // TEMPLATE VERSION
//   // =========================================================

//   private getTemplateVersion(
//     template: any,
//   ): number {
//     const version =
//       template?.version ?? 1;

//     if (
//       !Number.isInteger(version) ||
//       version < 1
//     ) {
//       throw new BadRequestException(
//         `Template "${
//           template?.name ?? 'unknown'
//         }" has an invalid version. Template version must be a positive integer.`,
//       );
//     }

//     return version;
//   }

//   // =========================================================
//   // NORMALIZE ID
//   // =========================================================

//   private getDocumentId(
//     value: any,
//   ): string | null {
//     if (!value) {
//       return null;
//     }

//     if (
//       typeof value === 'string'
//     ) {
//       return value;
//     }

//     if (
//       typeof value.toString === 'function'
//     ) {
//       return value.toString();
//     }

//     return null;
//   }

//   // =========================================================
//   // PAGE RESOLUTION
//   // =========================================================

//   private async resolvePageId(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<string> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     if (pageId) {
//       const validPageId =
//         this.toValidId(
//           pageId,
//           'page',
//         );

//       await this.pagesService
//         .findByIdForTenantAndEventOrThrow(
//           validPageId,
//           validOrgId,
//           validEventId,
//         );

//       return validPageId;
//     }

//     const homePage =
//       await this.pagesService.ensureHomePage(
//         validOrgId,
//         validEventId,
//       );

//     const resolvedId =
//       this.getDocumentId(
//         homePage?._id,
//       ) ??
//       this.getDocumentId(
//         homePage?.id,
//       );

//     if (!resolvedId) {
//       throw new BadRequestException(
//         'Unable to resolve Home page ID.',
//       );
//     }

//     return resolvedId;
//   }

//   // =========================================================
//   // TEMPLATE SECTION KEY
//   // =========================================================

//   /**
//    * Returns the stable template section identity.
//    *
//    * IMPORTANT:
//    *
//    * `key` is the preferred identity.
//    *
//    * `type-order` is ONLY a legacy fallback for old templates
//    * that do not have explicit keys.
//    *
//    * New templates should always have explicit keys.
//    */
//   private getTemplateSectionKey(
//     section: any,
//     index?: number,
//   ): string {
//     if (
//       typeof section?.key === 'string' &&
//       section.key.trim()
//     ) {
//       return section.key.trim();
//     }

//     if (
//       section?.type &&
//       Number.isInteger(
//         section?.order,
//       )
//     ) {
//       return `${section.type}-${section.order}`;
//     }

//     if (
//       section?.type &&
//       index !== undefined
//     ) {
//       return `${section.type}-${index}`;
//     }

//     return '';
//   }

//   // =========================================================
//   // NORMALIZE TEMPLATE KEY
//   // =========================================================

//   private normalizeTemplateKey(
//     value: unknown,
//   ): string {
//     if (
//       typeof value !== 'string'
//     ) {
//       return '';
//     }

//     return value
//       .replace(/\s+/g, ' ')
//       .trim()
//       .toLowerCase();
//   }

//   // =========================================================
//   // TEMPLATE SECTION POOL
//   // =========================================================

//   private getTemplateSectionPool(
//     template: any,
//   ): any[] {
//     if (
//       Array.isArray(
//         template?.defaultPages,
//       ) &&
//       template.defaultPages.length > 0
//     ) {
//       return template.defaultPages.flatMap(
//         (page: any) =>
//           Array.isArray(
//             page?.sections,
//           )
//             ? page.sections
//             : [],
//       );
//     }

//     if (
//       Array.isArray(
//         template?.defaultSections,
//       )
//     ) {
//       return template.defaultSections;
//     }

//     return [];
//   }

//   // =========================================================
//   // TEMPLATE SECTION MAP
//   // =========================================================

//   private buildTemplateSectionMap(
//     template: any,
//   ): Map<string, any> {
//     const map =
//       new Map<string, any>();

//     const pool =
//       this.getTemplateSectionPool(
//         template,
//       );

//     pool.forEach(
//       (
//         section: any,
//         index: number,
//       ) => {
//         const explicitKey =
//           this.normalizeTemplateKey(
//             section?.key,
//           );

//         const generatedKey =
//           this.normalizeTemplateKey(
//             this.getTemplateSectionKey(
//               section,
//               index,
//             ),
//           );

//         /*
//          * Explicit key is the real identity.
//          */
//         if (explicitKey) {
//           map.set(
//             explicitKey,
//             section,
//           );
//         }

//         /*
//          * Legacy type-order key.
//          */
//         if (
//           generatedKey &&
//           generatedKey !== explicitKey
//         ) {
//           map.set(
//             generatedKey,
//             section,
//           );
//         }
//       },
//     );

//     return map;
//   }

//   // =========================================================
//   // TEMPLATE SECTIONS BY TYPE
//   // =========================================================

//   private findTemplateSectionsByType(
//     template: any,
//     type: string,
//   ): any[] {
//     const normalizedType =
//       this.normalizeTemplateKey(
//         type,
//       );

//     if (!normalizedType) {
//       return [];
//     }

//     return this.getTemplateSectionPool(
//       template,
//     ).filter(
//       (section: any) =>
//         this.normalizeTemplateKey(
//           section?.type,
//         ) === normalizedType,
//     );
//   }

//   // =========================================================
//   // RESOLVE TEMPLATE SECTION
//   // =========================================================

//   /**
//    * Resolve the template section belonging to an event section.
//    *
//    * PRIMARY IDENTITY:
//    *
//    *   sourceTemplateSectionKey
//    *
//    * Legacy recovery:
//    *
//    *   If the source key points at a different section because an
//    *   older implementation matched sections by array position,
//    *   a unique type match can recover the correct source.
//    *
//    * This is particularly important for corrupted records such as:
//    *
//    *   event:
//    *     type = programme
//    *     order = 4
//    *     sourceTemplateSectionKey = speakers-4
//    *
//    * while the actual template has:
//    *
//    *   programme-5
//    *
//    * In that case the unique `programme` section is the safer match.
//    */
//   private resolveTemplateSection(
//     eventSection: any,
//     template: any,
//     templateMap: Map<string, any>,
//   ): any | null {
//     const sourceKey =
//       this.normalizeTemplateKey(
//         eventSection
//           ?.sourceTemplateSectionKey,
//       );

//     const eventType =
//       this.normalizeTemplateKey(
//         eventSection?.type,
//       );

//     const eventOrder =
//       Number.isInteger(
//         eventSection?.order,
//       )
//         ? eventSection.order
//         : null;

//     // -------------------------------------------------------
//     // 1. STABLE SOURCE KEY
//     // -------------------------------------------------------

//     if (sourceKey) {
//       const source =
//         templateMap.get(
//           sourceKey,
//         );

//       if (source) {
//         const sourceType =
//           this.normalizeTemplateKey(
//             source?.type,
//           );

//         const sourceOrder =
//           Number.isInteger(
//             source?.order,
//           )
//             ? source.order
//             : null;

//         /*
//          * The source key is authoritative when:
//          *
//          * - the template section type matches the event section
//          *   type, OR
//          *
//          * - the order is still the same.
//          *
//          * This allows legitimate changes such as:
//          *
//          * speakers -> livestream
//          *
//          * where the source key is livestream-3.
//          */
//         if (
//           sourceType === eventType ||
//           sourceOrder === eventOrder
//         ) {
//           return source;
//         }

//         /*
//          * If both type and order disagree, this can be a legacy
//          * positional-corruption record.
//          *
//          * Continue to recovery instead of blindly trusting the
//          * corrupted source key.
//          */
//       }
//     }

//     // -------------------------------------------------------
//     // 2. UNIQUE EVENT TYPE
//     // -------------------------------------------------------

//     if (eventType) {
//       const sameType =
//         this.findTemplateSectionsByType(
//           template,
//           eventType,
//         );

//       if (
//         sameType.length === 1
//       ) {
//         return sameType[0];
//       }
//     }

//     // -------------------------------------------------------
//     // 3. TYPE + ORDER
//     // -------------------------------------------------------

//     if (
//       eventType &&
//       eventOrder !== null
//     ) {
//       const typeOrderKey =
//         `${eventType}-${eventOrder}`;

//       const typeOrderMatch =
//         templateMap.get(
//           typeOrderKey,
//         );

//       if (typeOrderMatch) {
//         return typeOrderMatch;
//       }
//     }

//     // -------------------------------------------------------
//     // 4. UNIQUE ORDER
//     // -------------------------------------------------------

//     if (
//       eventOrder !== null
//     ) {
//       const candidates =
//         this.getTemplateSectionPool(
//           template,
//         ).filter(
//           (section: any) =>
//             Number.isInteger(
//               section?.order,
//             ) &&
//             section.order ===
//               eventOrder,
//         );

//       if (
//         candidates.length === 1
//       ) {
//         return candidates[0];
//       }
//     }

//     return null;
//   }

//   // =========================================================
//   // NORMALIZE CONTENT
//   // =========================================================

//   private normalizeForComparison(
//     value: any,
//   ): any {
//     if (
//       value === null ||
//       value === undefined
//     ) {
//       return value;
//     }

//     if (
//       value instanceof Date
//     ) {
//       return value.toISOString();
//     }

//     if (
//       typeof value === 'object' &&
//       typeof value.toHexString ===
//         'function'
//     ) {
//       return value.toHexString();
//     }

//     if (Array.isArray(value)) {
//       return value.map(
//         (item) =>
//           this.normalizeForComparison(
//             item,
//           ),
//       );
//     }

//     if (
//       typeof value === 'object'
//     ) {
//       const normalized:
//         Record<string, any> = {};

//       for (
//         const key of Object.keys(
//           value,
//         ).sort()
//       ) {
//         normalized[key] =
//           this.normalizeForComparison(
//             value[key],
//           );
//       }

//       return normalized;
//     }

//     return value;
//   }

//   // =========================================================
//   // CONTENT COMPARISON
//   // =========================================================

//   private sectionContentMatchesTemplate(
//     eventSection: any,
//     templateSection: any,
//   ): boolean {
//     const eventContent =
//       this.normalizeForComparison(
//         eventSection?.content ?? {},
//       );

//     const templateContent =
//       this.normalizeForComparison(
//         templateSection?.content ?? {},
//       );

//     return (
//       JSON.stringify(
//         eventContent,
//       ) ===
//       JSON.stringify(
//         templateContent,
//       )
//     );
//   }

//   // =========================================================
//   // TEMPLATE SECTION CHANGED
//   // =========================================================

//   private sectionChangedFromTemplate(
//     eventSection: any,
//     templateSection: any,
//   ): boolean {
//     if (!templateSection) {
//       return false;
//     }

//     /*
//      * Content changes count.
//      */
//     if (
//       !this.sectionContentMatchesTemplate(
//         eventSection,
//         templateSection,
//       )
//     ) {
//       return true;
//     }

//     /*
//      * Type changes count.
//      *
//      * Example:
//      *
//      * speakers -> livestream
//      */
//     const eventType =
//       this.normalizeTemplateKey(
//         eventSection?.type,
//       );

//     const templateType =
//       this.normalizeTemplateKey(
//         templateSection?.type,
//       );

//     if (
//       eventType !== templateType
//     ) {
//       return true;
//     }

//     /*
//      * Order changes are structural changes,
//      * but they should NOT be treated as content changes.
//      *
//      * Reordering can be applied separately.
//      *
//      * We intentionally do not return true here.
//      */
//     return false;
//   }

//   // =========================================================
//   // CREATE
//   // =========================================================

//   async create(
//     organizationId: string,
//     eventId: string,
//     dto: CreateSectionDto & {
//       pageId?: string;
//       sourceTemplateSectionKey?: string | null;
//       sourceTemplateVersion?: number | null;
//       sourceTemplateContentHash?: string | null;
//       customizedByOrganizer?: boolean;
//     },
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const pageId =
//       await this.resolvePageId(
//         validOrgId,
//         validEventId,
//         dto.pageId,
//       );

//     return this.sectionRepo.create({
//       ...dto,

//       organizationId:
//         validOrgId,

//       eventId:
//         validEventId,

//       pageId,

//       content:
//         dto.content ?? {},

//       order:
//         dto.order ?? 0,

//       visible:
//         dto.visible ?? true,

//       sourceTemplateSectionKey:
//         dto.sourceTemplateSectionKey ??
//         null,

//       sourceTemplateVersion:
//         dto.sourceTemplateVersion ??
//         null,

//       sourceTemplateContentHash:
//         dto.sourceTemplateContentHash ??
//         null,

//       customizedByOrganizer:
//         dto.customizedByOrganizer ??
//         false,
//     });
//   }

//   // =========================================================
//   // CREATE MANY
//   // =========================================================

//   async createMany(
//     sections: BatchSectionPayload[],
//   ): Promise<SectionDocument[]> {
//     if (
//       !Array.isArray(sections) ||
//       sections.length === 0
//     ) {
//       return [];
//     }

//     const pageCache =
//       new Map<string, string>();

//     const resolvedSections:
//       Record<string, any>[] = [];

//     for (
//       const section of sections
//     ) {
//       const orgId =
//         this.toValidId(
//           section.organizationId,
//           'organization',
//         );

//       const eventId =
//         this.toValidId(
//           section.eventId,
//           'event',
//         );

//       let pageId: string | undefined =
//         section.pageId ?? undefined;

//       if (pageId) {
//         pageId =
//           this.toValidId(
//             pageId,
//             'page',
//           );

//         await this.pagesService
//           .findByIdForTenantAndEventOrThrow(
//             pageId,
//             orgId,
//             eventId,
//           );
//       } else {
//         const cacheKey =
//           `${orgId}:${eventId}`;

//         const cachedPageId =
//           pageCache.get(
//             cacheKey,
//           );

//         if (cachedPageId) {
//           pageId = cachedPageId;
//         } else {
//           const homePage =
//             await this.pagesService
//               .ensureHomePage(
//                 orgId,
//                 eventId,
//               );

//           const homePageId =
//             this.getDocumentId(
//               homePage?._id,
//             ) ??
//             this.getDocumentId(
//               homePage?.id,
//             );

//           if (!homePageId) {
//             throw new BadRequestException(
//               'Unable to resolve Home page ID.',
//             );
//           }

//           pageId = homePageId;
//           pageCache.set(
//             cacheKey,
//             pageId,
//           );
//         }
//       }

//       resolvedSections.push({
//         type:
//           section.type,

//         content:
//           section.content ?? {},

//         organizationId:
//           orgId,

//         eventId:
//           eventId,

//         pageId,

//         order:
//           section.order ?? 0,

//         visible:
//           section.visible ?? true,

//         sourceTemplateSectionKey:
//           section.sourceTemplateSectionKey ??
//           null,

//         sourceTemplateVersion:
//           section.sourceTemplateVersion ??
//           null,

//         sourceTemplateContentHash:
//           section.sourceTemplateContentHash ??
//           null,

//         customizedByOrganizer:
//           section.customizedByOrganizer ??
//           false,
//       });
//     }

//     if (
//       this.sectionRepo.createMany
//     ) {
//       return this.sectionRepo.createMany(
//         resolvedSections,
//       );
//     }

//     return Promise.all(
//       resolvedSections.map(
//         (section) =>
//           this.sectionRepo.create(
//             section,
//           ),
//       ),
//     );
//   }

//   // =========================================================
//   // FIND BY EVENT
//   // =========================================================

//   async findByEvent(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<SectionDocument[]> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const all =
//       await this.sectionRepo.findByEvent(
//         validEventId,
//         validOrgId,
//       );

//     if (!pageId) {
//       return all;
//     }

//     const validPageId =
//       this.toValidId(
//         pageId,
//         'page',
//       );

//     await this.pagesService
//       .findByIdForTenantAndEventOrThrow(
//         validPageId,
//         validOrgId,
//         validEventId,
//       );

//     return all.filter(
//       (section) =>
//         section.pageId &&
//         String(section.pageId) ===
//           validPageId,
//     );
//   }

//   // =========================================================
//   // LIST FOR EVENT
//   // =========================================================

//   async listForEvent(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<SectionDocument[]> {
//     return this.findByEvent(
//       organizationId,
//       eventId,
//       pageId,
//     );
//   }

//   // =========================================================
//   // FIND ONE
//   // =========================================================

//   async findOne(
//     organizationId: string,
//     eventId: string,
//     id: string,
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validSectionId =
//       this.toValidId(
//         id,
//         'section',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const section =
//       await this.sectionRepo
//         .findByIdForTenantAndEvent(
//           validSectionId,
//           validOrgId,
//           validEventId,
//         );

//     if (!section) {
//       throw new NotFoundException(
//         `Section with ID ${validSectionId} not found`,
//       );
//     }

//     return section;
//   }

//   // =========================================================
//   // TEMPLATE SOURCE
//   // =========================================================

//   async stampTemplateSource(
//     sectionId: string,
//     organizationId: string,
//     key: string,
//     version: number,
//     contentHash: string,
//   ) {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validSectionId =
//       this.toValidId(
//         sectionId,
//         'section',
//       );

//     if (
//       !key ||
//       typeof key !== 'string'
//     ) {
//       throw new BadRequestException(
//         'Template section key is required.',
//       );
//     }

//     if (
//       !Number.isInteger(version) ||
//       version < 1
//     ) {
//       throw new BadRequestException(
//         'Template version must be a positive integer.',
//       );
//     }

//     if (
//       !contentHash ||
//       typeof contentHash !== 'string'
//     ) {
//       throw new BadRequestException(
//         'Template content hash is required.',
//       );
//     }

//     await assertFound(
//       await this.sectionRepo
//         .findByIdForTenant(
//           validSectionId,
//           validOrgId,
//         ),
//       'Section not found',
//     );

//     return assertFound(
//       await this.sectionRepo.updateById(
//         validSectionId,
//         {
//           sourceTemplateSectionKey:
//             key,

//           sourceTemplateVersion:
//             version,

//           sourceTemplateContentHash:
//             contentHash,
//         } as any,
//       ),
//       'Section not found',
//     );
//   }

//   // =========================================================
//   // UPDATE
//   // =========================================================

//   async update(
//     organizationId: string,
//     eventId: string,
//     id: string,
//     dto:
//       | Partial<CreateSectionDto>
//       | UpdateSectionDto
//       | (Partial<CreateSectionDto> & {
//           pageId?: string;
//         }),
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validSectionId =
//       this.toValidId(
//         id,
//         'section',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const existing =
//       await this.sectionRepo
//         .findByIdForTenantAndEvent(
//           validSectionId,
//           validOrgId,
//           validEventId,
//         );

//     if (!existing) {
//       throw new NotFoundException(
//         `Section with ID ${validSectionId} not found for this event`,
//       );
//     }

//     const updatePayload:
//       Record<string, any> = {};

//     // -------------------------------------------------------
//     // TYPE
//     // -------------------------------------------------------

//     if (
//       dto.type !== undefined
//     ) {
//       updatePayload.type =
//         dto.type;
//     }

//     // -------------------------------------------------------
//     // ORDER
//     // -------------------------------------------------------

//     if (
//       dto.order !== undefined
//     ) {
//       updatePayload.order =
//         dto.order;
//     }

//     // -------------------------------------------------------
//     // VISIBILITY
//     // -------------------------------------------------------

//     if (
//       dto.visible !== undefined
//     ) {
//       updatePayload.visible =
//         dto.visible;
//     }

//     // -------------------------------------------------------
//     // PAGE
//     // -------------------------------------------------------

//     if (
//       'pageId' in dto &&
//       dto.pageId !== undefined
//     ) {
//       updatePayload.pageId =
//         await this.resolvePageId(
//           validOrgId,
//           validEventId,
//           dto.pageId,
//         );
//     }

//     // -------------------------------------------------------
//     // CONTENT
//     // -------------------------------------------------------

//     if (
//       dto.content !== undefined
//     ) {
//       updatePayload.content = {
//         ...(existing.content ?? {}),
//         ...(dto.content ?? {}),
//       };

//       /*
//        * Content edits made through the editor are organizer
//        * customizations.
//        */
//       updatePayload.customizedByOrganizer =
//         true;
//     }

//     // -------------------------------------------------------
//     // TEMPLATE METADATA
//     // -------------------------------------------------------

//     /*
//      * These fields belong to template synchronization.
//      *
//      * Normal organizer updates must never overwrite them.
//      */
//     delete updatePayload
//       .sourceTemplateSectionKey;

//     delete updatePayload
//       .sourceTemplateVersion;

//     delete updatePayload
//       .sourceTemplateContentHash;

//     /*
//      * customizedByOrganizer is controlled above.
//      */
//     delete updatePayload
//       .customizedByOrganizer;

//     if (
//       dto.content !== undefined
//     ) {
//       updatePayload.customizedByOrganizer =
//         true;
//     }

//     // -------------------------------------------------------
//     // NOTHING TO UPDATE
//     // -------------------------------------------------------

//     if (
//       Object.keys(
//         updatePayload,
//       ).length === 0
//     ) {
//       return existing;
//     }

//     // -------------------------------------------------------
//     // UPDATE
//     // -------------------------------------------------------

//     const updated =
//       await this.sectionRepo.updateById(
//         validSectionId,
//         updatePayload,
//       );

//     return assertFound(
//       updated,
//       'Section not found after update execution',
//     );
//   }

//   // =========================================================
//   // REORDER
//   // =========================================================

//   async reorder(
//     organizationId: string,
//     eventId: string,
//     orderedIds: string[],
//   ): Promise<void> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     if (
//       !Array.isArray(orderedIds)
//     ) {
//       throw new BadRequestException(
//         'orderedIds must be an array',
//       );
//     }

//     for (
//       const id of orderedIds
//     ) {
//       this.toValidId(
//         id,
//         'section',
//       );
//     }

//     return this.sectionRepo.reorder(
//       validOrgId,
//       validEventId,
//       orderedIds,
//     );
//   }

//   // =========================================================
//   // REMOVE
//   // =========================================================

//   async remove(
//     organizationId: string,
//     eventId: string,
//     id: string,
//   ): Promise<{ deleted: true }> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validSectionId =
//       this.toValidId(
//         id,
//         'section',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const section =
//       await this.sectionRepo
//         .findByIdForTenantAndEvent(
//           validSectionId,
//           validOrgId,
//           validEventId,
//         );

//     if (!section) {
//       throw new NotFoundException(
//         `Section with ID ${validSectionId} not found for this event`,
//       );
//     }

//     const deleted =
//       await this.sectionRepo
//         .deleteByIdForTenant(
//           validSectionId,
//           validOrgId,
//         );

//     return assertDeleted(
//       deleted,
//       'Section not found or already deleted',
//     );
//   }

//   // =========================================================
//   // AVAILABLE TEMPLATE UPDATES
//   // =========================================================

//   async listAvailableUpdates(
//     eventId: string,
//     organizationId: string,
//     templatesService: any,
//   ) {
//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     // -------------------------------------------------------
//     // EVENT
//     // -------------------------------------------------------

//     const event =
//       await this.eventsService
//         .findByIdForTenantOrThrow(
//           validEventId,
//           validOrgId,
//         );

//     if (!event.templateId) {
//       return [];
//     }

//     // -------------------------------------------------------
//     // TEMPLATE
//     // -------------------------------------------------------

//     let template: any;

//     try {
//       template =
//         await templatesService.findByIdOrThrow(
//           event.templateId.toString(),
//         );
//     } catch (err: any) {
//       this.logger.warn(
//         `Unable to resolve source template ` +
//           `${event.templateId} ` +
//           `for event ${validEventId}. ` +
//           `Skipping template update check: ` +
//           `${
//             err?.message ??
//             'Template unavailable'
//           }`,
//       );

//       return [];
//     }

//     const templateVersion =
//       this.getTemplateVersion(
//         template,
//       );

//     // -------------------------------------------------------
//     // EVENT SECTIONS
//     // -------------------------------------------------------

//     const sections =
//       await this.listForEvent(
//         validOrgId,
//         validEventId,
//       );

//     if (
//       !sections ||
//       sections.length === 0
//     ) {
//       return [];
//     }

//     // -------------------------------------------------------
//     // TEMPLATE MAP
//     // -------------------------------------------------------

//     const templateSectionsByKey =
//       this.buildTemplateSectionMap(
//         template,
//       );

//     // -------------------------------------------------------
//     // FIND REAL UPDATES
//     // -------------------------------------------------------

//     const updates =
//       sections
//         .map(
//           (section: any) => {
//             const templateSection =
//               this.resolveTemplateSection(
//                 section,
//                 template,
//                 templateSectionsByKey,
//               );

//             if (!templateSection) {
//               this.logger.debug(
//                 `Template update skipped for section ` +
//                   `${
//                     section.id ??
//                     section._id?.toString()
//                   }: ` +
//                   `unable to resolve template source. ` +
//                   `key=${
//                     section.sourceTemplateSectionKey ??
//                     'null'
//                   }, ` +
//                   `type=${section.type}, ` +
//                   `order=${section.order}`,
//               );

//               return null;
//             }

//             const changed =
//               this.sectionChangedFromTemplate(
//                 section,
//                 templateSection,
//               );

//             if (!changed) {
//               return null;
//             }

//             /*
//              * Organizer customization protection.
//              *
//              * We expose the update but mark it as customized.
//              * The apply method will refuse to overwrite it unless
//              * explicitly forced.
//              */
//             return {
//               sectionId:
//                 this.getDocumentId(
//                   section.id,
//                 ) ??
//                 this.getDocumentId(
//                   section._id,
//                 ),

//               type:
//                 templateSection.type,

//               currentType:
//                 section.type,

//               currentVersion:
//                 section.sourceTemplateVersion ??
//                 null,

//               latestVersion:
//                 templateVersion,

//               customizedByOrganizer:
//                 section.customizedByOrganizer ??
//                 false,

//               sourceTemplateSectionKey:
//                 this.getTemplateSectionKey(
//                   templateSection,
//                 ),

//               order:
//                 templateSection.order,
//             };
//           },
//         )
//         .filter(
//           (update: any): update is {
//             sectionId: string;
//             type: string;
//             currentType: string;
//             currentVersion: number | null;
//             latestVersion: number;
//             customizedByOrganizer: boolean;
//             sourceTemplateSectionKey: string;
//             order: number;
//           } =>
//             !!update &&
//             !!update.sectionId,
//         );

//     // -------------------------------------------------------
//     // DIAGNOSTIC
//     // -------------------------------------------------------

//     this.logger.log(
//       `Template update check completed ` +
//         `for event ${validEventId}: ` +
//         `${updates.length} update(s) available`,
//     );

//     for (
//       const update of updates
//     ) {
//       this.logger.debug(
//         `Template update: ` +
//           `section=${update.sectionId}, ` +
//           `${update.currentType} -> ${update.type}, ` +
//           `key=${update.sourceTemplateSectionKey}, ` +
//           `order=${update.order}`,
//       );
//     }

//     return updates;
//   }

//   // =========================================================
//   // APPLY TEMPLATE UPDATE
//   // =========================================================

//   async applyTemplateUpdate(
//     sectionId: string,
//     organizationId: string,
//     templatesService: any,
//     options?: {
//       force?: boolean;
//     },
//   ) {
//     const validSectionId =
//       this.toValidId(
//         sectionId,
//         'section',
//       );

//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     // -------------------------------------------------------
//     // FIND SECTION
//     // -------------------------------------------------------

//     const section =
//       await assertFound(
//         await this.sectionRepo
//           .findByIdForTenant(
//             validSectionId,
//             validOrgId,
//           ),
//         'Section not found',
//       );

//     // -------------------------------------------------------
//     // EVENT
//     // -------------------------------------------------------

//     if (!section.eventId) {
//       throw new BadRequestException(
//         'This section is not associated with an event.',
//       );
//     }

//     const eventId =
//       section.eventId.toString();

//     const event =
//       await this.eventsService
//         .findByIdForTenantOrThrow(
//           eventId,
//           validOrgId,
//         );

//     // -------------------------------------------------------
//     // TEMPLATE REQUIRED
//     // -------------------------------------------------------

//     if (!event.templateId) {
//       throw new BadRequestException(
//         'This event is not using a template.',
//       );
//     }

//     // -------------------------------------------------------
//     // ORGANIZER CUSTOMIZATION
//     // -------------------------------------------------------

//     if (
//       section.customizedByOrganizer &&
//       !options?.force
//     ) {
//       throw new BadRequestException(
//         'This section has been customized by the organizer. ' +
//           'Explicitly force the template update to replace the customization.',
//       );
//     }

//     // -------------------------------------------------------
//     // LOAD TEMPLATE
//     // -------------------------------------------------------

//     const template =
//       await templatesService.findByIdOrThrow(
//         event.templateId.toString(),
//       );

//     const templateVersion =
//       this.getTemplateVersion(
//         template,
//       );

//     // -------------------------------------------------------
//     // TEMPLATE MAP
//     // -------------------------------------------------------

//     const templateSectionsByKey =
//       this.buildTemplateSectionMap(
//         template,
//       );

//     // -------------------------------------------------------
//     // RESOLVE SOURCE
//     // -------------------------------------------------------

//     const source =
//       this.resolveTemplateSection(
//         section,
//         template,
//         templateSectionsByKey,
//       );

//     if (!source) {
//       throw new BadRequestException(
//         'This section no longer exists in the template.',
//       );
//     }

//     // -------------------------------------------------------
//     // SOURCE KEY
//     // -------------------------------------------------------

//     const sourceKey =
//       this.getTemplateSectionKey(
//         source,
//       );

//     if (!sourceKey) {
//       throw new BadRequestException(
//         'The template section does not have a valid stable key.',
//       );
//     }

//     // -------------------------------------------------------
//     // APPLY
//     // -------------------------------------------------------

//     const updatePayload:
//       Record<string, any> = {
//         /*
//          * THIS IS THE CRITICAL FIX.
//          *
//          * If the template changed:
//          *
//          * speakers -> livestream
//          *
//          * the event section must also change:
//          *
//          * type = livestream
//          */
//         type:
//           source.type,

//         /*
//          * Keep the section position synchronized
//          * with the template.
//          */
//         order:
//           source.order ?? section.order,

//         /*
//          * Replace content with the template content.
//          */
//         content:
//           source.content ?? {},

//         /*
//          * Restore the correct stable identity.
//          */
//         sourceTemplateSectionKey:
//           sourceKey,

//         /*
//          * Stamp the template version that was applied.
//          */
//         sourceTemplateVersion:
//           templateVersion,

//         /*
//          * Content hash can be supplied by the template
//          * if available.
//          */
//         sourceTemplateContentHash:
//           source.sourceTemplateContentHash ??
//           null,

//         /*
//          * Template update is no longer considered an
//          * organizer customization.
//          */
//         customizedByOrganizer:
//           false,
//       };

//     // -------------------------------------------------------
//     // PAGE
//     // -------------------------------------------------------

//     /*
//      * If the template section contains page information,
//      * resolve it against the event's pages.
//      *
//      * We intentionally do not blindly copy a template page ID
//      * because template page IDs and event page IDs are different
//      * Mongo documents.
//      */
//     if (
//       source.pageId
//     ) {
//       const templatePageId =
//         this.getDocumentId(
//           source.pageId,
//         );

//       if (
//         templatePageId
//       ) {
//         /*
//          * We only update pageId when the existing event section
//          * already has a valid event page relationship.
//          *
//          * Page mapping between template pages and event pages
//          * should be handled by the template-instantiation layer.
//          */
//       }
//     }

//     // -------------------------------------------------------
//     // DATABASE UPDATE
//     // -------------------------------------------------------

//     const updated =
//       await this.sectionRepo.updateById(
//         validSectionId,
//         updatePayload,
//       );

//     const result =
//       await assertFound(
//         updated,
//         'Section not found',
//       );

//     this.logger.log(
//       `Applied template update to section ` +
//         `${validSectionId}: ` +
//         `${section.type} -> ${source.type}, ` +
//         `key=${sourceKey}, ` +
//         `version=${templateVersion}`,
//     );

//     return result;
//   }
// }


// import {
//   Injectable,
//   Inject,
//   forwardRef,
//   Logger,
//   NotFoundException,
//   BadRequestException,
// } from '@nestjs/common';

// import { Types } from 'mongoose';

// import type {
//   ISectionRepository,
// } from './interfaces/section-repository.interface';

// import {
//   SECTION_REPOSITORY,
// } from './interfaces/section-repository.interface';

// import {
//   assertFound,
//   assertDeleted,
// } from '../../../common/utils/assert-found.util';

// import {
//   CreateSectionDto,
// } from './dto/create-section.dto';

// import {
//   UpdateSectionDto,
// } from './dto/update-section.dto';

// import {
//   EventsService,
// } from '../events.service';

// import {
//   SectionDocument,
// } from './schemas/section.schema';

// import {
//   PagesService,
// } from '../pages/pages.service';

// export interface BatchSectionPayload {
//   organizationId: string;
//   eventId: string;
//   type: string;
//   content: Record<string, unknown>;
//   order?: number;
//   visible?: boolean;
//   pageId?: string;
// }

// @Injectable()
// export class SectionsService {
//   private readonly logger =
//     new Logger(SectionsService.name);

//   constructor(
//     @Inject(SECTION_REPOSITORY)
//     private readonly sectionRepo:
//       ISectionRepository,

//     @Inject(
//       forwardRef(() => EventsService),
//     )
//     private readonly eventsService:
//       EventsService,

//     @Inject(
//       forwardRef(() => PagesService),
//     )
//     private readonly pagesService:
//       PagesService,
//   ) {}

//   // =========================================================
//   // HELPERS
//   // =========================================================

//   private toValidId(
//     id: string,
//     label: string,
//   ): string {
//     if (
//       !id ||
//       !Types.ObjectId.isValid(id)
//     ) {
//       throw new BadRequestException(
//         `Invalid ${label} ID format: ${id}`,
//       );
//     }

//     return id;
//   }

//   private async resolvePageId(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<string> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     if (pageId) {
//       const validPageId =
//         this.toValidId(
//           pageId,
//           'page',
//         );

//       await this.pagesService
//         .findByIdForTenantAndEventOrThrow(
//           validPageId,
//           validOrgId,
//           validEventId,
//         );

//       return validPageId;
//     }

//     const homePage =
//       await this.pagesService.ensureHomePage(
//         validOrgId,
//         validEventId,
//       );

//     const resolvedId =
//       homePage._id?.toString() ??
//       homePage.id?.toString();

//     if (!resolvedId) {
//       throw new BadRequestException(
//         'Unable to resolve Home page ID.',
//       );
//     }

//     return resolvedId;
//   }

//   // =========================================================
//   // CREATE
//   // =========================================================

//   async create(
//     organizationId: string,
//     eventId: string,
//     dto: CreateSectionDto & {
//       pageId?: string;
//     },
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const pageId =
//       await this.resolvePageId(
//         validOrgId,
//         validEventId,
//         dto.pageId,
//       );

//     return this.sectionRepo.create({
//       ...dto,

//       organizationId:
//         validOrgId,

//       eventId:
//         validEventId,

//       pageId,

//       content:
//         dto.content ?? {},

//       order:
//         dto.order ?? 0,

//       visible:
//         dto.visible ?? true,
//     });
//   }

//   // =========================================================
//   // CREATE MANY
//   // =========================================================

//   async createMany(
//     sections: BatchSectionPayload[],
//   ): Promise<SectionDocument[]> {
//     if (
//       !Array.isArray(sections) ||
//       sections.length === 0
//     ) {
//       return [];
//     }

//     const pageCache =
//       new Map<string, string>();

//     const resolvedSections:
//       Record<string, any>[] = [];

//     for (const section of sections) {
//       const orgId =
//         this.toValidId(
//           section.organizationId,
//           'organization',
//         );

//       const eventId =
//         this.toValidId(
//           section.eventId,
//           'event',
//         );

//       let pageId =
//         section.pageId;

//       if (pageId) {
//         pageId =
//           this.toValidId(
//             pageId,
//             'page',
//           );

//         await this.pagesService
//           .findByIdForTenantAndEventOrThrow(
//             pageId,
//             orgId,
//             eventId,
//           );
//       } else {
//         const cacheKey =
//           `${orgId}:${eventId}`;

//         pageId =
//           pageCache.get(cacheKey);

//         if (!pageId) {
//           const homePage =
//             await this.pagesService
//               .ensureHomePage(
//                 orgId,
//                 eventId,
//               );

//           pageId =
//             homePage._id?.toString() ??
//             homePage.id?.toString();

//           if (!pageId) {
//             throw new BadRequestException(
//               'Unable to resolve Home page ID.',
//             );
//           }

//           pageCache.set(
//             cacheKey,
//             pageId,
//           );
//         }
//       }

//       resolvedSections.push({
//         type:
//           section.type,

//         content:
//           section.content ?? {},

//         organizationId:
//           orgId,

//         eventId:
//           eventId,

//         pageId,

//         order:
//           section.order ?? 0,

//         visible:
//           section.visible ?? true,
//       });
//     }

//     if (this.sectionRepo.createMany) {
//       return this.sectionRepo.createMany(
//         resolvedSections,
//       );
//     }

//     return Promise.all(
//       resolvedSections.map(
//         (section) =>
//           this.sectionRepo.create(
//             section,
//           ),
//       ),
//     );
//   }

//   // =========================================================
//   // FIND BY EVENT
//   // =========================================================

//   async findByEvent(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<SectionDocument[]> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const all =
//       await this.sectionRepo.findByEvent(
//         validEventId,
//         validOrgId,
//       );

//     if (!pageId) {
//       return all;
//     }

//     const validPageId =
//       this.toValidId(
//         pageId,
//         'page',
//       );

//     await this.pagesService
//       .findByIdForTenantAndEventOrThrow(
//         validPageId,
//         validOrgId,
//         validEventId,
//       );

//     return all.filter(
//       (section) =>
//         section.pageId &&
//         String(section.pageId) ===
//           validPageId,
//     );
//   }

//   // =========================================================
//   // LIST FOR EVENT
//   // =========================================================

// async listForEvent(
//     organizationId: string,
//     eventId: string,
//     pageId?: string,
//   ): Promise<SectionDocument[]> {
//     return this.findByEvent(
//       organizationId,
//       eventId,
//       pageId,
//     );
//   }

//   // =========================================================
//   // FIND ONE
//   // =========================================================

//   async findOne(
//     organizationId: string,
//     eventId: string,
//     id: string,
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validSectionId =
//       this.toValidId(
//         id,
//         'section',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const section =
//       await this.sectionRepo
//         .findByIdForTenantAndEvent(
//           validSectionId,
//           validOrgId,
//           validEventId,
//         );

//     if (!section) {
//       throw new NotFoundException(
//         `Section with ID ${validSectionId} not found`,
//       );
//     }

//     return section;
//   }

//   // =========================================================
//   // UPDATE
//   // =========================================================

//   async update(
//     organizationId: string,
//     eventId: string,
//     id: string,
//     dto:
//       | Partial<CreateSectionDto>
//       | UpdateSectionDto
//       | (Partial<CreateSectionDto> & {
//           pageId?: string;
//         }),
//   ): Promise<SectionDocument> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     const validSectionId =
//       this.toValidId(
//         id,
//         'section',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     const existing =
//       await this.sectionRepo
//         .findByIdForTenantAndEvent(
//           validSectionId,
//           validOrgId,
//           validEventId,
//         );

//     if (!existing) {
//       throw new NotFoundException(
//         `Section with ID ${validSectionId} not found for this event`,
//       );
//     }

//     const updatePayload:
//       Record<string, any> = {
//       ...dto,
//     };

//     if (
//       'pageId' in dto &&
//       dto.pageId !== undefined
//     ) {
//       updatePayload.pageId =
//         await this.resolvePageId(
//           validOrgId,
//           validEventId,
//           dto.pageId,
//         );
//     }

//     if (
//       dto.content !== undefined
//     ) {
//       updatePayload.content = {
//         ...(existing.content ?? {}),
//         ...(dto.content ?? {}),
//       };
//     }

//     const updated =
//       await this.sectionRepo.updateById(
//         validSectionId,
//         updatePayload,
//       );

//     return assertFound(
//       updated,
//       'Section not found after update execution',
//     );
//   }

//   // =========================================================
//   // REORDER
//   // =========================================================

//   async reorder(
//     organizationId: string,
//     eventId: string,
//     orderedIds: string[],
//   ): Promise<void> {
//     const validOrgId =
//       this.toValidId(
//         organizationId,
//         'organization',
//       );

//     const validEventId =
//       this.toValidId(
//         eventId,
//         'event',
//       );

//     await this.eventsService
//       .findByIdForTenantOrThrow(
//         validEventId,
//         validOrgId,
//       );

//     if (!Array.isArray(orderedIds)) {
//       throw new BadRequestException(
//         'orderedIds must be an array',
//       );
//     }

//     for (const id of orderedIds) {
//       this.toValidId(
//         id,
//         'section',
//       );
//     }

//     return this.sectionRepo.reorder(
//       validOrgId,
//       validEventId,
//       orderedIds,
//     );
//   }

//   // =========================================================
//   // REMOVE
//   // =========================================================

// async remove(
//   organizationId: string,
//   eventId: string,
//   id: string,
// ): Promise<{ deleted: true }> {
//   const validOrgId =
//     this.toValidId(
//       organizationId,
//       'organization',
//     );

//   const validEventId =
//     this.toValidId(
//       eventId,
//       'event',
//     );

//   const validSectionId =
//     this.toValidId(
//       id,
//       'section',
//     );

//   await this.eventsService
//     .findByIdForTenantOrThrow(
//       validEventId,
//       validOrgId,
//     );

//   /*
//    * IMPORTANT:
//    *
//    * Verify the section belongs to BOTH:
//    *
//    * organizationId
//    * eventId
//    *
//    * before performing the delete.
//    */
//   const section =
//     await this.sectionRepo
//       .findByIdForTenantAndEvent(
//         validSectionId,
//         validOrgId,
//         validEventId,
//       );

//   if (!section) {
//     throw new NotFoundException(
//       `Section with ID ${validSectionId} not found for this event`,
//     );
//   }

//   const deleted =
//     await this.sectionRepo
//       .deleteByIdForTenant(
//         validSectionId,
//         validOrgId,
//       );

//   return assertDeleted(
//     deleted,
//     'Section not found or already deleted',
//   );
// }
// }