import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QueuesModule } from '../queues/queues.module';
import { ArchiveModule } from '../modules/archive/archive.module';
import { DocumentReminderJob } from './document-reminder.job';
import { ArchiveJob } from './archive.job';

@Module({
  imports: [ScheduleModule.forRoot(), QueuesModule, ArchiveModule],
  providers: [DocumentReminderJob, ArchiveJob],
  exports: [DocumentReminderJob, ArchiveJob],
})
export class JobsModule {}
