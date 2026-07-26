/**
 * Minimal shape of a Multer-processed file, declared locally instead of
 * relying on the ambient Express.Multer.File global (which needs
 * @types/express + @types/multer to both resolve correctly at compile
 * time — some deploy environments don't pick up that merge even when
 * both packages are installed). This avoids the dependency on ambient
 * global typing entirely, so builds behave identically everywhere.
 */
export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}