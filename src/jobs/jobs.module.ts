import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ArchiveModule } from '../modules/archive/archive.module';
import { QueuesModule } from '../queues/queues.module';
import { ArchiveJob } from './archive.job';
import { DocumentExpiryJob } from './document-expiry.job';
import { DocumentReminderJob } from './document-reminder.job';

@Module({
  imports: [ScheduleModule.forRoot(), QueuesModule, ArchiveModule],
  providers: [DocumentReminderJob, DocumentExpiryJob, ArchiveJob],
  exports: [DocumentReminderJob, DocumentExpiryJob, ArchiveJob],
})
export class JobsModule {}
