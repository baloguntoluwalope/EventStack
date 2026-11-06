import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { IQrCodeService } from '../interfaces/qrcode-service.interface';

@Injectable()
export class QrCodeProvider implements IQrCodeService {
  private readonly logger = new Logger(QrCodeProvider.name);

  async generate(data: string): Promise<string> {
    try {
      // toDataURL returns a base64 PNG, directly usable as an <img src>
      // with no separate file upload or hosting step — the simplest
      // correct default. Swapping to Cloudinary-hosted QR images later
      // is a one-file change here, nothing downstream needs to know.
      return await QRCode.toDataURL(data, { width: 400, margin: 2 });
    } catch (err: any) {
      this.logger.error(`Failed to generate QR code for "${data}": ${err.message}`);
      throw err;
    }
  }
}