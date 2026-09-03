import { Controller, Param, Sse, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject, filter, map } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { MatchesService } from '../matches/matches.service';
import { TournamentsService } from '../tournaments/tournaments.service';

interface LiveUpdate {
  matchId: string;
  type: string;
  payload: Record<string, any>;
}

/**
 * KNOWN LIMITATION — SSE reconnection has no event replay.
 *
 * The stream below is a live, in-memory RxJS Subject with no buffer or
 * persisted event log backing it. If a client's connection drops (mobile
 * network blip, tab backgrounded, server restart) and reconnects, they
 * receive only events emitted AFTER reconnection — anything that happened
 * while disconnected is silently missed. There is no Last-Event-ID
 * support and no catch-up mechanism.
 *
 * Practical impact: a spectator who loses connection for even a few
 * seconds during a goal will not see that goal via the live stream. They
 * would need to re-fetch match state via GET /public/sports/matches/:id
 * (which reads the current, correct, authoritative state) to resync —
 * this is NOT automatic; the frontend must implement that fallback.
 *
 * NOT fixed in this pass, per explicit instruction: no SSE replay buffer,
 * no event log, no Last-Event-ID handling. A real fix would mean either
 * (a) a bounded in-memory ring buffer per match replayed on reconnect, or
 * (b) treating MatchEvent documents themselves as the replay source
 * (they already exist, ordered, in MongoDB) — option (b) is the more
 * architecturally honest fix, since it reuses data that already exists
 * rather than introducing a second event log, and is the recommended
 * approach whenever this limitation is actually addressed.
 */
@Controller('public/sports')
export class LiveGateway {
  private readonly stream$ = new Subject<LiveUpdate>();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly tournamentsService: TournamentsService,
  ) {}

  @OnEvent('match.event.created')
  onMatchEvent(payload: LiveUpdate) {
    this.stream$.next(payload);
  }

  @OnEvent('match.state.updated')
  onMatchState(payload: LiveUpdate) {
    this.stream$.next(payload);
  }

  @Sse('matches/:matchId/live')
  async live(@Param('matchId') matchId: string): Promise<Observable<MessageEvent>> {
    const match = await this.matchesService.findByIdPublicOrThrow(matchId);
    await this.tournamentsService.findByIdPublicOrThrow(match.tournamentId.toString());

    return this.stream$.pipe(
      filter((update) => update.matchId === matchId),
      map((update) => ({ data: update }) as MessageEvent),
    );
  }
}