import { ThemeDocument } from '../schemas/theme.schema';

export interface IThemeRepository {
  create(data: Partial<ThemeDocument>): Promise<ThemeDocument>;
  findById(id: string): Promise<ThemeDocument | null>;
  findMany(filter: Record<string, any>): Promise<ThemeDocument[]>;
  updateById(id: string, data: Partial<ThemeDocument>): Promise<ThemeDocument | null>;
  deleteById(id: string): Promise<boolean>;
}

export const THEME_REPOSITORY = 'THEME_REPOSITORY';