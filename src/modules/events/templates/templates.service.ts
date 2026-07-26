import { Injectable, Inject } from '@nestjs/common';
import type { ITemplateRepository } from './interfaces/template-repository.interface';
import { TEMPLATE_REPOSITORY } from './interfaces/template-repository.interface';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @Inject(TEMPLATE_REPOSITORY) private templateRepo: ITemplateRepository,
  ) {}

  create(dto: CreateTemplateDto) {
    return this.templateRepo.create(dto);
  }

  async findByIdOrThrow(id: string) {
    return assertFound(await this.templateRepo.findById(id), 'Template not found');
  }

  /** Public catalog — active templates only. */
  list(category?: string) {
    return this.templateRepo.findMany(category ? { category, active: true } : { active: true });
  }

  /** Admin management view — everything, including inactive/premium/draft. */
  listAllForAdmin(category?: string) {
    return this.templateRepo.findMany(category ? { category } : {});
  }

  async update(id: string, dto: Partial<CreateTemplateDto & { active: boolean }>) {
    return assertFound(await this.templateRepo.updateById(id, dto), 'Template not found');
  }

  async remove(id: string) {
    return assertDeleted(await this.templateRepo.deleteById(id), 'Template not found');
  }
}