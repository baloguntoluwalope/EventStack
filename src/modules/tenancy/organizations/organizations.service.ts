import { Injectable, Inject } from '@nestjs/common';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateOrganizationDto } from './dto/create-organization.dto';

import type { IOrganizationRepository } from './interfaces/organization-repository.interface';
import { ORGANIZATION_REPOSITORY } from './interfaces/organization-repository.interface';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) 
    private readonly orgRepo: IOrganizationRepository,
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
    return assertDeleted(await this.orgRepo.deleteById(id), 'Organization not found');
  }

  // --- Aggregate Metrics ---

  countAll() {
    return this.orgRepo.count();
  }
}