import { TaskDocument } from '../schemas/task.schema';

export interface ITaskRepository {
  create(data: Partial<TaskDocument>): Promise<TaskDocument>;
  findByIdForTenant(id: string, organizationId: string): Promise<TaskDocument | null>;
  findByEventForTenant(eventId: string, organizationId: string): Promise<TaskDocument[]>;
  findByAssigneeForTenant(userId: string, organizationId: string): Promise<TaskDocument[]>;
  updateById(id: string, data: Partial<TaskDocument>): Promise<TaskDocument | null>;
  deleteByIdForTenant(id: string, organizationId: string): Promise<boolean>;
}
export const TASK_REPOSITORY = 'TASK_REPOSITORY';