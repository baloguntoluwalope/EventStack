import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { FormsService } from './forms.service';
import { FormSubmissionsService } from './form-submissions.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@ApiTags('forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantContextGuard)
@Controller('organizations/:orgId/forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly submissionsService: FormSubmissionsService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Post()
  @ApiOperation({ summary: 'Create a registration form' })
  create(@Param('orgId') orgId: string, @Body() dto: CreateFormDto) { return this.formsService.create(orgId, dto); }


    @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Post('check-in/:ticketCode')
  @ApiOperation({ summary: 'Check in an attendee by scanning their ticket QR code' })
  checkIn(@Param('orgId') orgId: string, @Param('ticketCode') ticketCode: string) {
    return this.submissionsService.checkIn(orgId, ticketCode);
  }

  @Get()
  @ApiOperation({ summary: 'List forms, optionally filtered by owner and purpose' })
list(
  @Param('orgId') orgId: string,
  @Query('ownerType') ownerType?: string,
  @Query('ownerId') ownerId?: string,
  @Query('purpose') purpose?: string,
) {
  return this.formsService.list(orgId, { ownerType, ownerId, purpose });
}

  @Get(':id')
  @ApiOperation({ summary: 'Get form detail' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) { return this.formsService.findByIdOrThrow(id, orgId); }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a form (fields, payment settings, status)' })
  update(@Param('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateFormDto) { return this.formsService.update(id, orgId, dto); }

  @UseGuards(PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a form' })
  remove(@Param('orgId') orgId: string, @Param('id') id: string) { return this.formsService.remove(id, orgId); }
}