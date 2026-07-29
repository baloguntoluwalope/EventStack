// src/common/guards/custom-throttler.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Bypass rate-limiting completely for browser preflight checks
    if (request.method === 'OPTIONS') {
      return true;
    }

    return super.canActivate(context);
  }
}