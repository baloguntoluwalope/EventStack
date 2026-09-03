import {
  Injectable,
} from '@nestjs/common';

import {
  InjectModel,
} from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  BaseTenantRepository,
} from '../../../../common/base/base-tenant.repository';

import {
  Page,
  PageDocument,
} from '../schemas/page.schema';

import {
  IPageRepository,
} from '../interfaces/page-repository.interface';

@Injectable()
export class MongoosePageRepository
  extends BaseTenantRepository<PageDocument>
  implements IPageRepository
{
  constructor(
    @InjectModel(Page.name)
    model: Model<PageDocument>,
  ) {
    super(model);
  }

  // =========================================================
  // FIND ALL PAGES FOR EVENT
  // =========================================================

  async findByEventForTenant(
    eventId: string,
    organizationId: string,
  ): Promise<PageDocument[]> {
    if (
      !Types.ObjectId.isValid(eventId) ||
      !Types.ObjectId.isValid(organizationId)
    ) {
      return [];
    }

    return this.model
      .find({
        eventId:
          new Types.ObjectId(eventId),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        deletedAt: null,
      })
      .sort({
        order: 1,
      })
      .exec();
  }

  // =========================================================
  // FIND HOME PAGE
  // =========================================================

  async findHomeForEvent(
    eventId: string,
    organizationId?: string,
  ): Promise<PageDocument | null> {
    if (
      !Types.ObjectId.isValid(eventId)
    ) {
      return null;
    }

    const filter: Record<string, any> = {
      eventId:
        new Types.ObjectId(eventId),

      isHome: true,

      deletedAt: null,
    };

    /*
     * Public callers do not have tenant context.
     *
     * Internal callers MUST provide organizationId.
     */
    if (
      organizationId !== undefined
    ) {
      if (
        !Types.ObjectId.isValid(
          organizationId,
        )
      ) {
        return null;
      }

      filter.organizationId =
        new Types.ObjectId(
          organizationId,
        );
    }

    return this.model
      .findOne(filter)
      .exec();
  }

  // =========================================================
  // FIND BY SLUG
  // =========================================================

  async findBySlugForEvent(
    eventId: string,
    slug: string,
  ): Promise<PageDocument | null> {
    if (
      !Types.ObjectId.isValid(eventId)
    ) {
      return null;
    }

    return this.model
      .findOne({
        eventId:
          new Types.ObjectId(eventId),

        slug,

        deletedAt: null,
      })
      .exec();
  }

  // =========================================================
  // FIND BY ID + TENANT + EVENT
  // =========================================================

  async findByIdForTenantAndEvent(
    id: string,
    organizationId: string,
    eventId: string,
  ): Promise<PageDocument | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(
        organizationId,
      ) ||
      !Types.ObjectId.isValid(eventId)
    ) {
      return null;
    }

    return this.model
      .findOne({
        _id:
          new Types.ObjectId(id),

        organizationId:
          new Types.ObjectId(
            organizationId,
          ),

        eventId:
          new Types.ObjectId(eventId),

        deletedAt: null,
      })
      .exec();
  }
}