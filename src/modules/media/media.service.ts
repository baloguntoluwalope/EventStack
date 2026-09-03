import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { IMediaRepository } from './interfaces/media-repository.interface';
import { MEDIA_REPOSITORY } from './interfaces/media-repository.interface';
import type { IStorageProvider } from '../../common/providers/storage-provider.interface';
import { STORAGE_PROVIDER } from '../../common/providers/storage-provider.interface';
import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { MediaType } from './schemas/media.schema';
import { EventsService } from '../events/events.service';
import type { UploadedFile } from '../../common/types/uploaded-file.type';

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly mediaRepo: IMediaRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
    private readonly eventsService: EventsService,
  ) {}

  async upload(
    organizationId: string,
    eventId: string,
    file?: UploadedFile,
    type: MediaType = MediaType.IMAGE,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided for upload');
    }

    // Verify event ownership before uploading to cloud storage
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);

    const result = await this.storageProvider.uploadBuffer(
      file.buffer,
      `events/${eventId}`,
    );

    return this.mediaRepo.create({
      organizationId: new Types.ObjectId(organizationId),
      eventId: new Types.ObjectId(eventId),
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

    async uploadOrgLevel(organizationId: string, file: UploadedFile) {
    const result = await this.storageProvider.uploadBuffer(file.buffer, `orgs/${organizationId}`);
    return { url: result.url };
  }
}