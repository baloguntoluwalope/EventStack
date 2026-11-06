import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  IFormRepository,
  FORM_REPOSITORY,
} from './interfaces/form-repository.interface';
import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { SlugService } from '../../common/utils/slug.util';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { EventsService } from '../events/events.service';
import { TournamentsService } from '../sports/tournaments/tournaments.service';
import { FormOwnerType } from './schemas/form.schema';



@Injectable()
export class FormsService {
  constructor(
    @Inject(FORM_REPOSITORY) private readonly formRepo: IFormRepository,
    private readonly slugService: SlugService,
    private readonly eventsService: EventsService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  private async verifyOwner(organizationId: string, ownerType: FormOwnerType, ownerId: string) {
    if (ownerType === FormOwnerType.ORGANIZATION) {
      if (ownerId !== organizationId) throw new ForbiddenException('Cannot attach a form to another organization');
      return;
    }
    if (ownerType === FormOwnerType.EVENT) {
      // Throws a 404 if the event doesn't exist OR belongs to another org,
      // so it never reveals whether someone else's event ID is real.
      await this.eventsService.findByIdForTenantOrThrow(ownerId, organizationId);
      return;
    }
    if (ownerType === FormOwnerType.TOURNAMENT) {
      await this.tournamentsService.findByIdOrThrow(ownerId, organizationId);
    }
  }

  async create(organizationId: string, dto: CreateFormDto) {
    await this.verifyOwner(organizationId, dto.ownerType, dto.ownerId); 
    const slugBase = dto.slug || dto.title;
    const isSlugTaken = (candidate: string) => this.formRepo.isSlugTaken(organizationId, candidate);
    let slug = await this.slugService.resolveUnique(slugBase, isSlugTaken);

    const price = dto.price
      ? {
          amount: dto.price.amount,
          currency: dto.price.currency ?? 'NGN',
        }
      : null;

    const closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    const formData = {
      ...dto,
      fields: dto.fields.map((field) => ({
        ...field,
        required: field.required ?? false,
        options: field.options ?? [],
        placeholder: field.placeholder ?? '',
      })),
      price,
      closesAt,
      organizationId: organizationId as any,
      ownerId: dto.ownerId as any,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.formRepo.create({ ...formData, slug });
      } catch (error) {
        const isDuplicateKey = (error as { code?: number })?.code === 11000;
        if (!isDuplicateKey || attempt === 4) throw error;

        // The unique index is authoritative if another request inserts after
        // our availability check. Retry with a fresh organization-wide slug.
        slug = await this.slugService.resolveUnique(`${slugBase}-${attempt + 2}`, isSlugTaken);
      }
    }

    throw new Error('Unable to allocate a unique form slug');
  }
  
  async findByIdOrThrow(id: string, organizationId: string) {
    return assertFound(
      await this.formRepo.findByIdForTenant(id, organizationId),
      'Form not found',
    );
  }

  

  async update(id: string, organizationId: string, dto: UpdateFormDto) {
    await this.findByIdOrThrow(id, organizationId);
    return assertFound(
      await this.formRepo.updateById(id, dto as any),
      'Form not found',
    );
  }

  async remove(id: string, organizationId: string) {
    return assertDeleted(
      await this.formRepo.deleteByIdForTenant(id, organizationId),
      'Form not found',
    );
  }

  async findPublicOrThrow(organizationId: string, slug: string) {
    const form = await assertFound(
      await this.formRepo.findBySlugPublic(organizationId, slug),
      'Form not found',
    );

    if (form.status !== 'published') {
      throw new NotFoundException('Form not found');
    }

    return form;
  }

  list(organizationId: string, filters: { ownerType?: string; ownerId?: string; purpose?: string } = {}) {
  return this.formRepo.findByOwnerForTenant(organizationId, filters);
}

  async findByIdPublicOrThrow(id: string) {
    return assertFound(await this.formRepo.findByIdPublic(id), 'Form not found');
  }

  /** What an anonymous visitor may see. An explicit allow-list is safer
   * than returning the whole document, because a field added to the
   * schema later can't leak by accident. */
  toPublicView(form: any) {
    return {
      id: form.id, title: form.title, description: form.description, slug: form.slug,
      purpose: form.purpose, fields: form.fields,
      shifts: (form.shifts ?? []).map((s: any) => ({
        id: s._id.toString(), label: s.label, startsAt: s.startsAt, endsAt: s.endsAt, capacity: s.capacity,
      })),
      requiresPayment: form.requiresPayment, price: form.price, closesAt: form.closesAt,
    };
  }
}