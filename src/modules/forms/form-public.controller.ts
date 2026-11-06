import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { FormSubmissionsService } from './form-submissions.service';

/**
 * Three different first segments (forms / form-payments / tickets), so no
 * route can ever be mistaken for another.
 */
@ApiTags('public-forms')
@Controller('public')
export class FormPublicController {
  constructor(
    private formsService: FormsService,
    private submissionsService: FormSubmissionsService,
  ) {}

  @Get('forms/:orgId/:slug')
  @ApiOperation({ summary: 'Load a published form to render it' })
  async getForm(@Param('orgId') orgId: string, @Param('slug') slug: string) {
    const form = await this.formsService.findPublicOrThrow(orgId, slug);
    return this.formsService.toPublicView(form);
  }

    @Get('form-payments/status')
  @ApiOperation({ summary: 'Payment state for the return page. Read-only. Pass ?checkout_id= (Bachs) or ?reference=' })
  paymentStatus(@Query('checkout_id') checkoutId?: string, @Query('reference') reference?: string) {
    return this.submissionsService.getPaymentStatus({ checkoutId, reference });
  }

  @Get('tickets/:ticketCode')
  @ApiOperation({ summary: 'Ticket page data: title, QR code, check-in state' })
  getTicket(@Param('ticketCode') ticketCode: string) {
    return this.submissionsService.getTicketPublic(ticketCode);
  }
}