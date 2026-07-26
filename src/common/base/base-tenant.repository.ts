import type { FilterQuery } from 'mongoose';
import { BaseMongooseRepository } from './base-mongoose.repository';

export abstract class BaseTenantRepository<T> extends BaseMongooseRepository<T> {

  findByIdForTenant(id: string, organizationId: string): Promise<T | null> {
    return this.findOne({ _id: id, organizationId } as FilterQuery<T>);
  }

  findManyForTenant(
    organizationId: string,
    filter: FilterQuery<T> = {},
    options: { page?: number; limit?: number } = {},
  ): Promise<T[]> {
    return this.findMany({ ...filter, organizationId } as FilterQuery<T>, options);
  }

  // Atomic update scoped to tenant
  updateByIdForTenant(id: string, organizationId: string, data: Partial<T>): Promise<T | null> {
    return this.model
      .findOneAndUpdate(
        // Inherits deletedAt: null from internal helper, while guaranteeing organizationId match
        { _id: id, organizationId, deletedAt: null } as FilterQuery<T>,
        { ...data, $inc: { version: 1 } } as any,
        { new: true },
      )
      .exec();
  }

  // Atomic soft-delete scoped to tenant
  async deleteByIdForTenant(id: string, organizationId: string): Promise<boolean> {
    const res = await this.model
      .findOneAndUpdate(
        { _id: id, organizationId, deletedAt: null } as FilterQuery<T>,
        { deletedAt: new Date() } as any,
      )
      .exec();
    return !!res;
  }
}