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