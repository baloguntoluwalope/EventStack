import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';

import type { IOrganizationRepository } from './interfaces/organization-repository.interface';
import { ORGANIZATION_REPOSITORY } from './interfaces/organization-repository.interface';

import type { IMembershipRepository } from '../members/interfaces/membership-repository.interface';
import { MEMBERSHIP_REPOSITORY } from '../members/interfaces/membership-repository.interface';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepo: IOrganizationRepository,
    @Inject(forwardRef(() => MEMBERSHIP_REPOSITORY))
    private readonly membershipRepo: IMembershipRepository,
  ) {}

  create(dto: CreateOrganizationDto) {
    return this.orgRepo.create(dto);
  }

  async findByIdOrThrow(id: string) {
    return assertFound(await this.orgRepo.findById(id), 'Organization not found');
  }

  async update(id: string, data: Partial<CreateOrganizationDto>) {
    return assertFound(await this.orgRepo.updateById(id, data), 'Organization not found');
  }

  async delete(id: string) {
    const org = assertDeleted(
      await this.orgRepo.softDeleteById(id),
      'Organization not found',
    );

    // Cascade: soft-delete all memberships tied to this org so populate()
    // never has to resolve a reference to a gone/soft-deleted organization.
    await this.membershipRepo.softDeleteManyByOrg(id);

    return org;
  }

  // --- Aggregate Metrics ---

  countAll() {
    return this.orgRepo.count();
  }
}