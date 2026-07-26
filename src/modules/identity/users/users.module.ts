import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { MongooseUserRepository } from './repositories/user.repository';
// Updated to match your exact file structure: ./interface/users-repository.interface
import { USER_REPOSITORY } from './interface/users-repository.interface';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [{ provide: USER_REPOSITORY, useClass: MongooseUserRepository }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}