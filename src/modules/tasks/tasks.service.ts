import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { ITaskRepository, TASK_REPOSITORY } from './interfaces/task.repository.interface';
import { assertFound, assertDeleted } from '../../common/utils/assert-found.util';
import { EventsService } from '../events/events.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskStatus } from './schemas/task.schema';

@Injectable()
export class TasksService {
  constructor(
    @Inject(TASK_REPOSITORY) private taskRepo: ITaskRepository,
    private eventsService: EventsService,
  ) {}

  async create(eventId: string, organizationId: string, assignedByUserId: string, dto: CreateTaskDto) {
    await this.eventsService.findByIdForTenantOrThrow(eventId, organizationId);
    return this.taskRepo.create({
      ...dto, eventId: eventId as any, organizationId: organizationId as any,
      assignedToUserId: dto.assignedToUserId as any, assignedByUserId: assignedByUserId as any,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
    });
  }

  listForEvent(eventId: string, organizationId: string) {
    return this.taskRepo.findByEventForTenant(eventId, organizationId);
  }

  /** The volunteer-facing endpoint — no permission check beyond being a
   * logged-in member of this organization. Everyone can see their own
   * tasks; nobody needs a special role for that. */
  listMine(userId: string, organizationId: string) {
    return this.taskRepo.findByAssigneeForTenant(userId, organizationId);
  }

  /**
   * Row-level ownership check, done here, not in a guard. A volunteer
   * can only move their OWN task between statuses — not assign tasks to
   * others, not touch anyone else's. This is deliberately different from
   * every PermissionsGuard check elsewhere in the app, which asks "does
   * your role allow this." Here the question is "is this yours."
   */
  async updateStatus(taskId: string, organizationId: string, currentUserId: string, status: TaskStatus) {
    const task = await assertFound(await this.taskRepo.findByIdForTenant(taskId, organizationId), 'Task not found');
    if (task.assignedToUserId.toString() !== currentUserId) {
      throw new ForbiddenException('You can only update tasks assigned to you');
    }
    return assertFound(await this.taskRepo.updateById(taskId, { status }), 'Task not found');
  }

  async remove(taskId: string, organizationId: string) {
    return assertDeleted(await this.taskRepo.deleteByIdForTenant(taskId, organizationId), 'Task not found');
  }
}