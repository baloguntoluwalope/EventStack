import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

interface AuditRecordedPayload {
  entity: string;
  action: string;
  userId: string | null;
  organizationId: string | null;
  entityId: string | null;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private model: Model<AuditLogDocument>) {}

  @OnEvent('audit.recorded')
  async handleAuditRecorded(payload: AuditRecordedPayload) {
    await this.model.create({
      entity: payload.entity,
      action: payload.action,
      userId: payload.userId,
      organizationId: payload.organizationId,
      entityId: payload.entityId,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    });
  }

  findForOrganization(organizationId: string, page = 1, limit = 50) {
    return this.model
      .find({ organizationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }

  findForEntity(entity: string, entityId: string) {
    return this.model.find({ entity, entityId }).sort({ createdAt: -1 }).exec();
  }
}