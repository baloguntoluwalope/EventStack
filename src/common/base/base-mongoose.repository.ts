import { Model } from 'mongoose';
import type { FilterQuery, UpdateQuery } from 'mongoose';

// Interface contract exported for feature repository interfaces to extend
export interface BaseRepositoryContract<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(filter: FilterQuery<T>): Promise<T | null>;
  findMany(
    filter?: FilterQuery<T>,
    options?: { page?: number; limit?: number },
  ): Promise<T[]>;
  count(filter?: FilterQuery<T>): Promise<number>;
  updateById(id: string, data: Partial<T>): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
  findByIdWithDeleted(id: string): Promise<T | null>;
  restore(id: string): Promise<T | null>;
  hardDeleteById(id: string): Promise<boolean>;
}

export abstract class BaseMongooseRepository<T> implements BaseRepositoryContract<T> {
  protected constructor(protected readonly model: Model<T>) {}

  private notDeleted(filter: FilterQuery<T> = {}): FilterQuery<T> {
    return { ...filter, deletedAt: null } as FilterQuery<T>;
  }

  async create(data: Partial<T>): Promise<T> {
    const created = new this.model({
      ...data,
      deletedAt: null,
      version: 0,
    });
    return (await created.save()) as unknown as T;
  }

  findById(id: string): Promise<T | null> {
    return this.model.findOne(this.notDeleted({ _id: id } as FilterQuery<T>)).exec();
  }

  findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(this.notDeleted(filter)).exec();
  }

  findMany(
    filter: FilterQuery<T> = {},
    options: { page?: number; limit?: number } = {},
  ): Promise<T[]> {
    const { page = 1, limit = 20 } = options;
    return this.model
      .find(this.notDeleted(filter))
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(this.notDeleted(filter)).exec();
  }

  updateById(id: string, data: Partial<T>): Promise<T | null> {
    const update = {
      $set: data,
      $inc: { version: 1 },
    } as UpdateQuery<T>;

    return this.model
      .findOneAndUpdate(
        this.notDeleted({ _id: id } as FilterQuery<T>),
        update,
        { new: true },
      )
      .exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const update = {
      $set: { deletedAt: new Date() },
    } as UpdateQuery<T>;

    const res = await this.model
      .findOneAndUpdate(
        this.notDeleted({ _id: id } as FilterQuery<T>),
        update,
      )
      .exec();

    return !!res;
  }

  findByIdWithDeleted(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async restore(id: string): Promise<T | null> {
    const update = {
      $set: { deletedAt: null },
    } as UpdateQuery<T>;

    return this.model
      .findOneAndUpdate({ _id: id } as FilterQuery<T>, update, { new: true })
      .exec();
  }

  async hardDeleteById(id: string): Promise<boolean> {
    const res = await this.model.findByIdAndDelete(id).exec();
    return !!res;
  }
}