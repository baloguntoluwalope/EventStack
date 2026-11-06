import { Controller, Post, Param, Req, HttpCode, RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentWebhookService } from './payment-webhook.service';

@ApiTags('payment-webhooks')
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private webhookService: PaymentWebhookService) {}

  @SkipThrottle() // the signature check protects this route, not a login
  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Provider webhook. Requires a valid provider signature, so Swagger "Try it out" will return 401.' })
  handle(@Param('provider') provider: string, @Req() req: RawBodyRequest<Request>) {
    // The signature covers the exact raw bytes (main.ts has rawBody: true).
    return this.webhookService.handle(provider, req.rawBody ?? Buffer.alloc(0), req.headers);
  }
}