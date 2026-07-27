import { Injectable, Inject } from '@nestjs/common';
import type { IThemeRepository } from './interfaces/theme-repository.interface';
import { THEME_REPOSITORY } from './interfaces/theme-repository.interface';
import { assertFound, assertDeleted } from '../../../common/utils/assert-found.util';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@Injectable()
export class ThemesService {
  constructor(
    @Inject(THEME_REPOSITORY) private readonly themeRepo: IThemeRepository,
  ) {}

  create(dto: CreateThemeDto) {
    return this.themeRepo.create(dto);
  }

  async findByIdOrThrow(id: string) {
    return assertFound(await this.themeRepo.findById(id), 'Theme not found');
  }

  list() {
    return this.themeRepo.findMany({ active: true });
  }

  listAllForAdmin() {
    return this.themeRepo.findMany({});
  }

  async update(id: string, dto: UpdateThemeDto) {
    return assertFound(await this.themeRepo.updateById(id, dto), 'Theme not found');
  }

  async remove(id: string) {
    return assertDeleted(await this.themeRepo.deleteById(id), 'Theme not found');
  }

  countAll() {
    return this.themeRepo.count();
  }
}