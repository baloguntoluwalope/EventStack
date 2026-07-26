export interface UploadResult {
  url: string;
  publicId: string;
}

export interface IStorageProvider {
  uploadBuffer(buffer: Buffer, folder: string): Promise<UploadResult>;
  deleteAsset(publicId: string): Promise<void>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';