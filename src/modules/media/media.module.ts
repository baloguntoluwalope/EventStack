import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Media, MediaSchema } from './schemas/media.schema';
import { MongooseMediaRepository } from './repositories/media.repository';
import { MEDIA_REPOSITORY } from './interfaces/media-repository.interface';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { STORAGE_PROVIDER } from '../../common/providers/storage-provider.interface';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { EventsModule } from '../events/events.module';
import { MembersModule } from '../tenancy/members/members.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    EventsModule,
    MembersModule,
  ],
  providers: [
    { provide: MEDIA_REPOSITORY, useClass: MongooseMediaRepository },
    { provide: STORAGE_PROVIDER, useClass: CloudinaryStorageProvider },
    MediaService,
  ],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}