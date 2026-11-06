import { Injectable } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import {
  Model,
  Connection,
  ClientSession,
  Types,
} from 'mongoose';

import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Event, EventDocument } from '../schemas/event.schema';
import { IEventRepository } from '../interfaces/event-repository.interface';
import { EventStatus } from '../../../common/constants/event-status.constants';

@Injectable()
export class MongooseEventRepository
  extends BaseTenantRepository<EventDocument>
  implements IEventRepository
{
  constructor(
    @InjectModel(Event.name)
    model: Model<EventDocument>,

    @InjectConnection()
    private readonly connection: Connection,
  ) {
    super(model);
  }

  override create(
    data: Partial<EventDocument>,
    session?: ClientSession,
  ): Promise<EventDocument> {
    return this.model
      .create([data], { session })
      .then(
        (documents) =>
          documents[0] as EventDocument,
      );
  }

  async withTransaction<T>(
    fn: (
      session: ClientSession,
    ) => Promise<T>,
  ): Promise<T> {
    const session =
      await this.connection.startSession();

    try {
      let result!: T;

      await session.withTransaction(
        async () => {
          result = await fn(session);
        },
      );

      return result;
    } finally {
      await session.endSession();
    }
  }

  async findBySlug(
    slug: string,
  ): Promise<EventDocument | null> {
    return this.model
      .findOne({
        slug,
        deletedAt: null,
      })
      .exec();
  }


 async findById(
  id: string,
): Promise<EventDocument | null> {
  if (!id || !Types.ObjectId.isValid(id)) {
    console.log(
      '[EventRepository] Invalid event ID:',
      id,
    );

    return null;
  }

  const objectId = new Types.ObjectId(id);

  console.log(
    '[EventRepository] Public event lookup:',
    {
      id,
      objectId: objectId.toString(),
      database: this.model.db.name,
      collection: this.model.collection.name,
    },
  );

  const event = await this.model
    .findOne({
      _id: objectId,
      deletedAt: null,
    })
    .exec();

  console.log(
    '[EventRepository] Public event result:',
    event
      ? {
          id: String(event._id),
          organizationId: String(
            event.organizationId,
          ),
          status: event.status,
          deletedAt: event.deletedAt,
          slug: event.slug,
        }
      : null,
  );

  return event;
}
  async findAllPublished(): Promise<EventDocument[]> {
    return this.model
      .find({
        status: EventStatus.PUBLISHED,
        deletedAt: null,
      })
      .exec();
  }

  async findArchivedForTenant(
     organizationId: string
    ): Promise<EventDocument[]> {
    if(!Types.ObjectId.isValid(organizationId)){
      return [];
    }

    return this.model
     .find({
      organizationId: new Types.ObjectId(organizationId),
      status: EventStatus.ARCHIVED,
      deletedAt: null,
     })
     .sort({
       updatedAt: -1,
     })
     .exec();

  }
  
  /**
 * Remove an event from the archived state.
 */
async unarchive(
  id: string,
  organizationId: string,
): Promise<EventDocument | null> {
  if (
    !Types.ObjectId.isValid(id) ||
    !Types.ObjectId.isValid(organizationId)
  ) {
    return null;
  }

  return this.model
    .findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        organizationId: new Types.ObjectId(organizationId),
        // Must currently be archived.
        status: EventStatus.ARCHIVED,
        // Deleted events cannot be unarchived.
        deletedAt: null,
      },
      {
        $set: {
          // Unarchive to draft rather than implicitly republishing.
          status: EventStatus.DRAFT,
        },
      },
      {
        new: true,
      },
    )
    .exec();
}

/**
 * =========================================================
 * DELETED / TRASH EVENTS
 * =========================================================
 */

/**
 * Returns all soft-deleted events for an organization.
 */
async findDeletedForTenant(
  organizationId: string,
): Promise<EventDocument[]> {
  if (!Types.ObjectId.isValid(organizationId)) {
    return [];
  }

  return this.model
    .find({
      organizationId: new Types.ObjectId(organizationId),
      deletedAt: {
        $ne: null,
      },
    })
    .sort({
      deletedAt: -1,
    })
    .exec();
}

/**
 * Restore a soft-deleted event.
 *
 * This does NOT create a new event.
 * It simply removes the deletedAt marker.
 */
async restore(
  id: string,
  organizationId?: string,
): Promise<EventDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  const filter: any = {
    _id: new Types.ObjectId(id),
    // Only deleted events can be restored.
    deletedAt: {
      $ne: null,
    },
  };

  if (organizationId) {
    if (!Types.ObjectId.isValid(organizationId)) {
      return null;
    }

    filter.organizationId = new Types.ObjectId(organizationId);
  }

  return this.model
    .findOneAndUpdate(
      filter,
      {
        $set: {
          deletedAt: null,
        },
      },
      {
        new: true,
      },
    )
    .exec();
}

  /**
   * Explicit tenant lookup.
   *
   * This removes ambiguity from the inherited repository
   * when debugging event detail requests.
   */
  override findByIdForTenant(
    id: string,
    organizationId: string,
  ): Promise<EventDocument | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(
        organizationId,
      )
    ) {
      return Promise.resolve(null);
    }

    return this.model
      .findOne({
        _id: new Types.ObjectId(id),
        organizationId:
          new Types.ObjectId(organizationId),
        deletedAt: null,
      })
      .exec();
  }
}