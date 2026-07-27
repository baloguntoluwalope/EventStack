import { Injectable, Inject, ConflictException } from '@nestjs/common';

// Updated relative paths
import type { IUserRepository } from './interface/users-repository.interface';
import { USER_REPOSITORY } from './interface/users-repository.interface';
import { UserDocument } from './schemas/user.schema';

// Up 3 levels: users -> identity -> modules -> src (then into common)
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async create(data: Partial<UserDocument>) {
    if (data.email) {
      const existing = await this.userRepo.findByEmail(data.email);
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }
    return this.userRepo.create(data);
  }

  findById(id: string) {
    return this.userRepo.findById(id);
  }

  async findByIdOrThrow(id: string) {
    return assertFound(
      await this.userRepo.findById(id),
      'User not found',
    );
  }

  findByEmail(email: string) {
    return this.userRepo.findByEmail(email);
  }

  async updateById(id: string, data: Partial<UserDocument>) {
    await this.findByIdOrThrow(id);
    return assertFound(
      await this.userRepo.updateById(id, data),
      'User not found',
    );
  }

  async remove(id: string) {
    return assertDeleted(
      await this.userRepo.deleteById(id),
      'User not found',
    );
  }

  // --- Aggregate Metrics ---

  countAll() {
    return this.userRepo.count();
  }

  countPlatformAdmins() {
    return this.userRepo.count({ platformAdmin: true });
  }

  countVerified() {
    return this.userRepo.count({ emailVerified: true });
  }
}