import { Module } from '@nestjs/common';
import { PortalController } from './controllers/portal.controller';
import { PortalService, PORTAL_REPOSITORY } from './services/portal.service';
import { PrismaPortalRepository } from './repositories/prisma-portal.repository';
import { PortalAuthGuard } from './guards/portal-auth.guard';
import { LocalDiskStorage } from '../uploads/storage/local-disk.storage';

@Module({
  controllers: [PortalController],
  providers: [
    {
      provide: PORTAL_REPOSITORY,
      useClass: PrismaPortalRepository,
    },
    PortalService,
    PortalAuthGuard,
    LocalDiskStorage,
  ],
  exports: [PortalService],
})
export class PortalModule {}
