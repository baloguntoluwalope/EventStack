import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { TournamentsService } from './tournaments.service';

@ApiTags('public-sports-tournaments')
@Controller('public/events')
export class PublicTournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
  ) {}

  // =========================================================
  // PUBLIC TOURNAMENTS
  // =========================================================

  @Get(':eventId/tournaments')
  @ApiOperation({
    summary:
      'Get published tournaments for an event',
  })
  listForEvent(
    @Param('eventId') eventId: string,
  ) {
    return this.tournamentsService.listPublicForEvent(
      eventId,
    );
  }
}