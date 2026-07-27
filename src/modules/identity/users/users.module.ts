import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { MongooseUserRepository } from './repositories/user.repository';
import { USER_REPOSITORY } from './interface/users-repository.interface';
import { UsersService } from './users.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [{ provide: USER_REPOSITORY, useClass: MongooseUserRepository }, UsersService],
  exports: [USER_REPOSITORY, UsersService],
})
export class UsersModule {}