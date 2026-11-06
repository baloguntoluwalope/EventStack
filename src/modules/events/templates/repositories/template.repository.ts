import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongooseRepository } from '../../../../common/base/base-mongoose.repository';
import { Template, TemplateDocument } from '../schemas/template.schema';
import { ITemplateRepository } from '../interfaces/template-repository.interface';

@Injectable()
export class MongooseTemplateRepository
  extends BaseMongooseRepository<TemplateDocument>
  implements ITemplateRepository
{
  constructor(@InjectModel(Template.name) model: Model<TemplateDocument>) {
    super(model);
  }

  async create(data: Partial<TemplateDocument>): Promise<TemplateDocument> {
    const created = new this.model({
      ...data,
      deletedAt: null,
      version: data.version ?? 1,
    });

    return (await created.save()) as unknown as TemplateDocument;
  }

  async findBySlug(slug: string): Promise<TemplateDocument | null> {
    return this.model.findOne({ slug }).exec();
  }

  async updateById(
    id: string,
    updateData: Record<string, any>,
  ): Promise<TemplateDocument | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      )
      .exec();
  }
}