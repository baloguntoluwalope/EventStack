import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Form, FormDocument } from '../schemas/form.schema';
import { IFormRepository } from '../interfaces/form-repository.interface';

@Injectable()
export class MongooseFormRepository extends BaseTenantRepository<FormDocument> implements IFormRepository {
  constructor(@InjectModel(Form.name) model: Model<FormDocument>) {
    super(model);
  }

  findByIdForTenant(id: string, organizationId: string): Promise<FormDocument | null> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(organizationId)) {
      return Promise.resolve(null);
    }

    // Older form records may have organizationId stored as a BSON string,
    // while current schema writes and tenant lookups use ObjectIds.
    return this.model
      .findOne({
        _id: new Types.ObjectId(id),
        deletedAt: null,
        $expr: {
          $eq: [{ $toString: '$organizationId' }, organizationId],
        },
      })
      .exec();
  }

  findByIdPublic(id: string): Promise<FormDocument | null> {
    return this.findOne({ _id: id } as any);
  }

  findBySlugPublic(organizationId: string, slug: string): Promise<FormDocument | null> {
    return this.findOne({ organizationId: this.toObjectId(organizationId), slug } as any);
  }

  async isSlugTaken(organizationId: string, slug: string): Promise<boolean> {
    return !!(await this.model.exists({
      organizationId: this.toObjectId(organizationId),
      slug,
    } as any));
  }

  findByOwnerForTenant(
    organizationId: string,
    filters: { ownerType?: string; ownerId?: string; purpose?: string },
  ): Promise<FormDocument[]> {
    const filter: Record<string, unknown> = {
      organizationId: this.toObjectId(organizationId),
      deletedAt: null,
    };
    if (filters.ownerType) filter.ownerType = filters.ownerType;
    if (filters.ownerId) filter.ownerId = this.toObjectId(filters.ownerId);
    if (filters.purpose) filter.purpose = filters.purpose;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }
}
