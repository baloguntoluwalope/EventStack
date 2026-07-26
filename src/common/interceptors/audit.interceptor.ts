import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDITED_KEY, AuditMetadata } from '../decorators/audited.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDITED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((responseBody) => {
        this.eventEmitter.emit('audit.recorded', {
          entity: metadata.entity,
          action: metadata.action,
          userId: request.user?.userId ?? null,
          organizationId: request.params?.orgId ?? request.params?.organizationId ?? null,
          entityId: request.params?.id ?? responseBody?.id ?? null,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          occurredAt: new Date(),
        });
      }),
    );
  }
}