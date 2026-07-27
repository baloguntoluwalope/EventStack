// src/modules/identity/users/repositories/user.repository.ts

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseMongooseRepository } from '../../../../common/base/base-mongoose.repository';
import { User, UserDocument } from '../schemas/user.schema';
// Updated import path to match your actual file:
import { IUserRepository } from '../interface/users-repository.interface';

@Injectable()
export class MongooseUserRepository
  extends BaseMongooseRepository<UserDocument>
  implements IUserRepository
{
  constructor(@InjectModel(User.name) model: Model<UserDocument>) {
    super(model);
  }

  findByEmail(email: string) {
    return this.findOne({ email: email.toLowerCase() } as any);
  }

  
}