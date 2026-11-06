export interface IQrCodeService {
  /** Takes any string (usually a URL) and returns a renderable image —
   * a base64 data URL for now, swappable to a real Cloudinary-hosted URL
   * later without touching anything that calls generate(). */
  generate(data: string): Promise<string>;
}

export const QR_CODE_SERVICE = 'QR_CODE_SERVICE';