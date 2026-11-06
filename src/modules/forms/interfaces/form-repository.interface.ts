import { FormDocument } from "../schemas/form.schema";

export interface IFormRepository {
    create(data: Partial<FormDocument>): Promise<FormDocument>;
    findByIdForTenant(id: string, organizationid: string): Promise<FormDocument | null>;
     findManyForTenant(organizationId: string): Promise<FormDocument[]>;
    findByIdPublic(id: string): Promise<FormDocument | null>;
    findBySlugPublic(organizationId: string, slug: string): Promise<FormDocument | null>;
    isSlugTaken(organizationId: string, slug: string): Promise<boolean>;
    updateById(id: string, data: Partial<FormDocument>): Promise<FormDocument | null>;
    deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
    findByOwnerForTenant(organizationId: string, filters: { ownerType?: string; ownerId?: string; purpose?: string }): Promise<FormDocument[]>;
}

export const FORM_REPOSITORY= 'FORM_REPOSITORY';