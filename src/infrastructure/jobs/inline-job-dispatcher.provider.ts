import { Injectable, Logger } from '@nestjs/common';
import { IJobDispatcher } from './job-dispatcher.interface';

@Injectable()
export class InlineJobDispatcher implements IJobDispatcher {
  private readonly logger = new Logger(InlineJobDispatcher.name);

  async dispatch<T = any>(jobName: string, payload: T): Promise<void> {
    this.logger.debug(`[inline-job] ${jobName} dispatched (synchronous, no queue yet)`);
  }
}