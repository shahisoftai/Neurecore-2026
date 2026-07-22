import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { IndustriesModule } from '../industry/industries.module';
// Part 9 N5 — TenantsService.changeTier delegates to TierChangeService.changeTier
// so we share pre-flight + TierAuditLog + TierChangeRequest writes.
// TiersModule doesn't depend on TenantsModule (no circular import), so this
// import is safe.
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [IndustriesModule, TiersModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
