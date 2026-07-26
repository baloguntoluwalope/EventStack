import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongooseRepository } from '../../../../common/base/base-mongoose.repository';
import { Theme, ThemeDocument } from '../schemas/theme.schema';
import { IThemeRepository } from '../interfaces/theme-repository.interface';

@Injectable()
export class MongooseThemeRepository
  extends BaseMongooseRepository<ThemeDocument>
  implements IThemeRepository
{
  constructor(@InjectModel(Theme.name) model: Model<ThemeDocument>) {
    super(model);
  }
}