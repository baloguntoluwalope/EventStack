import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseTenantRepository } from '../../../common/base/base-tenant.repository';
import { Task, TaskDocument } from '../schemas/task.schema';
import { ITaskRepository } from '../interfaces/task.repository.interface';

@Injectable()
export class MongooseTaskRepository extends BaseTenantRepository<TaskDocument> implements ITaskRepository {
  constructor(@InjectModel(Task.name) model: Model<TaskDocument>) { super(model); }

  findByEventForTenant(eventId: string, organizationId: string) {
    return this.model.find({ eventId, organizationId, deletedAt: null }).sort({ dueAt: 1 }).exec();
  }

  /** "My Tasks" across every event in this organization — the volunteer
   * dashboard's single data source, regardless of which event each task
   * belongs to. */
  findByAssigneeForTenant(userId: string, organizationId: string) {
    return this.model.find({ assignedToUserId: userId, organizationId, deletedAt: null }).sort({ dueAt: 1 }).exec();
  }
}