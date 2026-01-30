import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QueuesModule } from '../queues/queues.module';
import { DocumentReminderJob } from './document-reminder.job';

@Module({
  imports: [ScheduleModule.forRoot(), QueuesModule],
  providers: [DocumentReminderJob],
  exports: [DocumentReminderJob],
})
export class JobsModule {}
