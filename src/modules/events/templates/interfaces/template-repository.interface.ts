import { TemplateDocument } from '../schemas/template.schema';

export interface ITemplateRepository {
  create(data: Partial<TemplateDocument>): Promise<TemplateDocument>;
  findById(id: string): Promise<TemplateDocument | null>;
  findBySlug(slug: string): Promise<any | null>;
  findMany(filter: Record<string, any>): Promise<TemplateDocument[]>;
  updateById(id: string, data: Partial<TemplateDocument>): Promise<TemplateDocument | null>;
  deleteById(id: string): Promise<boolean>;
  count(filter?: Record<string, any>): Promise<number>;
}

export const TEMPLATE_REPOSITORY = 'TEMPLATE_REPOSITORY';