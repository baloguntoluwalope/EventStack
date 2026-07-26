import { UserDocument } from '../schemas/user.schema';

export interface IUserRepository {
  create(data: Partial<UserDocument>): Promise<UserDocument>;
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findMany(filter: Record<string, any>): Promise<UserDocument[]>;
  updateById(id: string, data: Partial<UserDocument>): Promise<UserDocument | null>;
}

export const USER_REPOSITORY = 'USER_REPOSITORY';