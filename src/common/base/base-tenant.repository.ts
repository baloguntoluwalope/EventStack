import { FilterQuery, Types } from 'mongoose';
import { BaseMongooseRepository } from './base-mongoose.repository';

export abstract class BaseTenantRepository<T> extends BaseMongooseRepository<T> {

  /**
   * Helper to safely cast valid hex strings to Mongoose ObjectIds.
   * If a string is already an ObjectId or invalid, handles gracefully.
   */
  protected toObjectId(id: string | Types.ObjectId): Types.ObjectId | string {
    if (id instanceof Types.ObjectId) return id;
    if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
      return new Types.ObjectId(id);
    }
    return id;
  }

  findByIdForTenant(id: string, organizationId: string): Promise<T | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(organizationId)) {
      return Promise.resolve(null);
    }

    return this.findOne({
      _id: this.toObjectId(id),
      organizationId: this.toObjectId(organizationId),
      deletedAt: null,
    } as FilterQuery<T>);
  }

  findManyForTenant(
    organizationId: string,
    filter: FilterQuery<T> = {},
    options: { page?: number; limit?: number } = {},
  ): Promise<T[]> {
    if (!Types.ObjectId.isValid(organizationId)) {
      return Promise.resolve([]);
    }

    return this.findMany(
      {
        ...filter,
        organizationId: this.toObjectId(organizationId),
        deletedAt: null,
      } as FilterQuery<T>,
      options,
    );
  }

  // Atomic update scoped to tenant
  updateByIdForTenant(id: string, organizationId: string, data: Partial<T>): Promise<T | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(organizationId)) {
      return Promise.resolve(null);
    }

    return this.model
      .findOneAndUpdate(
        {
          _id: this.toObjectId(id),
          organizationId: this.toObjectId(organizationId),
          deletedAt: null,
        } as FilterQuery<T>,
        { ...data, $inc: { version: 1 } } as any,
        { new: true },
      )
      .exec();
  }

  // Atomic soft-delete scoped to tenant
  async deleteByIdForTenant(id: string, organizationId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(organizationId)) {
      return false;
    }

    const res = await this.model
      .findOneAndUpdate(
        {
          _id: this.toObjectId(id),
          organizationId: this.toObjectId(organizationId),
          deletedAt: null,
        } as FilterQuery<T>,
        { deletedAt: new Date() } as any,
      )
      .exec();

    return !!res;
  }
}