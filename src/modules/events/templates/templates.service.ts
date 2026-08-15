import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';

import type { ITemplateRepository } from './interfaces/template-repository.interface';
import { TEMPLATE_REPOSITORY } from './interfaces/template-repository.interface';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @Inject(TEMPLATE_REPOSITORY) private templateRepo: ITemplateRepository,
  ) {}

  /**
   * Helper to validate and convert string IDs to valid MongoDB ObjectIds.
   */
  private validateId(id: string): string {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid Template ID format: ${id}`);
    }
    return id;
  }

  async create(dto: CreateTemplateDto) {
    try {
      return await this.templateRepo.create(dto);
    } catch (err: any) {
      this.logger.error(`Failed to create template: ${err.message}`, err.stack);
      throw err;
    }
  }

  async findByIdOrThrow(id: string) {
    const validId = this.validateId(id);
    const template = await this.templateRepo.findById(validId);
    return assertFound(template, 'Template not found');
  }

  /** Public catalog — active templates only. */
  async list(category?: string) {
    try {
      const filter = category ? { category, active: true } : { active: true };
      return await this.templateRepo.findMany(filter);
    } catch (err: any) {
      this.logger.error(`Failed to list active templates: ${err.message}`, err.stack);
      throw err;
    }
  }

  /** Admin management view — everything, including inactive/premium/draft. */
  async listAllForAdmin(category?: string) {
    try {
      const filter = category ? { category } : {};
      return await this.templateRepo.findMany(filter);
    } catch (err: any) {
      this.logger.error(`Failed to list admin templates: ${err.message}`, err.stack);
      throw err;
    }
  }

  async update(id: string, dto: Partial<CreateTemplateDto & { active: boolean }>) {
    const validId = this.validateId(id);
    return assertFound(
      await this.templateRepo.updateById(validId, dto),
      'Template not found',
    );
  }

  async remove(id: string) {
    const validId = this.validateId(id);
    return assertDeleted(
      await this.templateRepo.deleteById(validId),
      'Template not found',
    );
  }

  async countAll() {
    try {
      if (typeof this.templateRepo.count === 'function') {
        return await this.templateRepo.count();
      }
      return 0;
    } catch (err: any) {
      this.logger.error(`Failed to count templates: ${err.message}`, err.stack);
      return 0;
    }
  }
}