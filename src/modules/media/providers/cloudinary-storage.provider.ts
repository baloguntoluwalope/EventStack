import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { IStorageProvider, UploadResult } from '../../../common/providers/storage-provider.interface';

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('storage.cloudinary.cloudName'),
      api_key: this.config.get('storage.cloudinary.apiKey'),
      api_secret: this.config.get('storage.cloudinary.apiSecret'),
    });
  }

  uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  async deleteAsset(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}