import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorage } from './storage/local.storage';
import { STORAGE_PROVIDER } from './storage/storage.interface';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(), // Memory da saqlash (keyin storage provider ga o'tkazamiz)
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorage,
    },
  ],
  exports: [FilesService, STORAGE_PROVIDER],
})
export class FilesModule {}
