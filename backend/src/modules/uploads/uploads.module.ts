import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { LocalDiskStorage } from './storage/local-disk.storage';
import { IUploadStorage } from './storage/storage.interface';

/**
 * UploadsModule — logo (and future avatar / document) uploads.
 *
 * DIP: UploadsService depends on the abstract `IUploadStorage` class (used as
 * DI token); the concrete `LocalDiskStorage` is bound here. To swap to S3 /
 * GCS / R2, replace the `useExisting` binding below with a different impl —
 * nothing else changes.
 *
 * Static serving: `GET /cdn/*` is wired in `main.ts` via `useStaticAssets`.
 * The controller only handles upload + delete.
 */
@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    LocalDiskStorage,
    {
      // Abstract-class token — the single swap point for storage backends.
      provide: IUploadStorage,
      useExisting: LocalDiskStorage,
    },
  ],
  exports: [UploadsService, IUploadStorage],
})
export class UploadsModule {}
