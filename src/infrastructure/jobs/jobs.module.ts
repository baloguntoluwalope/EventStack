import { Module, Global } from '@nestjs/common';
import { InlineJobDispatcher } from './inline-job-dispatcher.provider';
import { JOB_DISPATCHER } from './job-dispatcher.interface';

@Global()
@Module({
  providers: [{ provide: JOB_DISPATCHER, useClass: InlineJobDispatcher }],
  exports: [JOB_DISPATCHER],
})
export class JobsModule {}