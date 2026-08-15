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

  async findBySlug(slug: string): Promise<TemplateDocument | null> {
    return this.model.findOne({ slug }).exec();
  }
}