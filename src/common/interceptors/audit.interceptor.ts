import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDITED_KEY, AuditMetadata } from '../decorators/audited.decorator';

function pick(obj: any, fields?: string[]) {
  if (!obj || typeof obj !== 'object') return null;
  if (!fields || fields.length === 0) return obj;
  return Object.fromEntries(
    fields.filter((f) => f in obj).map((f) => [f, obj[f]]),
  );
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDITED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest();

    const resourceId =
      request.params?.id ??
      request.params?.matchId ??
      request.params?.fixtureId ??
      null;

    const organizationId =
      request.params?.orgId ??
      request.params?.organizationId ??
      null;

    return next.handle().pipe(
      tap((responseBody) => {
        const afterState = pick(responseBody, metadata.diffFields);
        const beforeState = request.auditBeforeState
          ? pick(request.auditBeforeState, metadata.diffFields)
          : null;

        this.eventEmitter.emit('audit.recorded', {
          entity: metadata.entity,
          action: metadata.action,
          userId: request.user?.userId ?? null,
          organizationId,
          entityId: responseBody?.id ?? responseBody?._id ?? resourceId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          beforeState,
          afterState,
          occurredAt: new Date(),
        });
      }),
    );
  }
}