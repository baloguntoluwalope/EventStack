import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantContextGuard } from '../tenancy/members/guards/tenant-context.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../../common/constants/permissions.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FormSubmissionsService } from './form-submissions.service';
import { SubmitFormDto } from './dto/submit-form.dto';
import { ReviewStatus } from './schemas/form-submission.schema';

@ApiTags('form-submissions')
@Controller('organizations/:orgId/forms/:formId/submissions')
export class FormSubmissionsController {
  constructor(private submissionsService: FormSubmissionsService) {}

  // Public on purpose: attendees don't have accounts.
  @Post()
  @ApiOperation({ summary: 'Submit a response. Returns a payment link when the form is paid.' })
  submit(@Param('orgId') orgId: string, @Param('formId') formId: string, @Body() dto: SubmitFormDto) {
    return this.submissionsService.submit(orgId, formId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Get()
  list(@Param('orgId') orgId: string, @Param('formId') formId: string) {
    return this.submissionsService.listForForm(formId, orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Post('check-in/:ticketCode')
  checkIn(@Param('orgId') orgId: string, @Param('ticketCode') ticketCode: string) {
    return this.submissionsService.checkIn(orgId, ticketCode);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.FORM_MANAGE)
  @Patch(':id/review')
  review(@Param('orgId') orgId: string, @Param('id') id: string, @Body('status') status: ReviewStatus) {
    return this.submissionsService.updateReviewStatus(id, orgId, status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission(Permission.MEMBER_INVITE)
  @Post(':id/convert-to-member')
  convertToMember(@Param('orgId') orgId: string, @Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.submissionsService.convertToMember(id, orgId, user.userId);
  }
}