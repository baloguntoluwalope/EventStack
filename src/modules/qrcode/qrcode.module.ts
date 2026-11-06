import { Module } from '@nestjs/common';
import { QrCodeProvider } from '../qrcode/providers/qrcode-provider'
import { QR_CODE_SERVICE } from './interfaces/qrcode-service.interface';

@Module({
  providers: [{ provide: QR_CODE_SERVICE, useClass: QrCodeProvider }],
  exports: [QR_CODE_SERVICE],
})
export class QrcodeModule {}