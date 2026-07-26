import { Injectable, Inject } from '@nestjs/common';

// Separate interface (type) from token (value)
import type { IMediaRepository } from './interfaces/media-repository.interface';
import { MEDIA_REPOSITORY } from './interfaces/media-repository.interface';

import type { IStorageProvider } from '../../common/providers/storage-provider.interface';
import { STORAGE_PROVIDER } from '../../common/providers/storage-provider.interface';

import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { MediaType } from './schemas/media.schema';
import { EventsService } from '../events/events.service';

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private mediaRepo: IMediaRepository,
    @Inject(STORAGE_PROVIDER) private storageProvider: IStorageProvider,
    private eventsService: EventsService,
  ) {}

  async upload(
    organizationId: string,
    eventId: string,
    file: Express.Multer.File,
    type: MediaType = MediaType.IMAGE,
  ) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    const result = await this.storageProvider.uploadBuffer(file.buffer, `events/${eventId}`);
    return this.mediaRepo.create({
      organizationId: organizationId as any,
      eventId: eventId as any,
      url: result.url,
      storagePublicId: result.publicId,
      type,
    });
  }

  async listForEvent(organizationId: string, eventId: string) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);
    return this.mediaRepo.findByEvent(eventId);
  }

  async remove(organizationId: string, id: string) {
    const media = await assertFound(
      await this.mediaRepo.findByIdForTenant(id, organizationId),
      'Media not found',
    );
    if (media.storagePublicId) {
      await this.storageProvider.deleteAsset(media.storagePublicId);
    }
    return assertDeleted(
      await this.mediaRepo.deleteByIdForTenant(id, organizationId),
      'Media not found',
    );
  }
}