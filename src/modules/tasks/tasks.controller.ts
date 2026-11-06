import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TASK_ASSIGN)
  @Post('events/:eventId/tasks')
  @ApiOperation({ summary: 'Assign a task to a volunteer for this event' })
  create(@Param('orgId') orgId: string, @Param('eventId') eventId: string, @CurrentUser() user: { userId: string }, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(eventId, orgId, user.userId, dto);
  }

  @Get('events/:eventId/tasks')
  @ApiOperation({ summary: 'List all tasks for an event (organizer view)' })
  listForEvent(@Param('orgId') orgId: string, @Param('eventId') eventId: string) {
    return this.tasksService.listForEvent(eventId, orgId);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'List tasks assigned to the current logged-in user' })
  listMine(@Param('orgId') orgId: string, @CurrentUser() user: { userId: string }) {
    return this.tasksService.listMine(user.userId, orgId);
  }

  @Patch('tasks/:id/status')
  @ApiOperation({ summary: 'Update the status of a task assigned to you' })
  updateStatus(@Param('orgId') orgId: string, @Param('id') id: string, @CurrentUser() user: { userId: string }, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(id, orgId, user.userId, dto.status);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.TASK_ASSIGN)
  @Delete('tasks/:id')
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.tasksService.remove(id, orgId);
  }
}