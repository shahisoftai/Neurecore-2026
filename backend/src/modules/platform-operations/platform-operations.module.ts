import { Module } from '@nestjs/common';
import {
  PLATFORM_HEALTH, AUDIT_CENTER, SECURITY_CENTER, OBSERVABILITY_ENGINE,
  DIAGNOSTICS_ENGINE, OPERATIONAL_READINESS, DEPLOYMENT_MANAGER,
  BACKUP_MANAGER, PLATFORM_OPS,
} from './contracts/platform-operations.interface';
import {
  HealthCenter, AuditCenter, SecurityCenter, ObservabilityEngine,
  DiagnosticsEngine, OperationalReadiness, DeploymentManager,
  BackupManager, PlatformOperations,
} from './engines/platform-engines.service';
import { PlatformOpsController } from './platform-operations.controller';

@Module({
  controllers: [PlatformOpsController],
  providers: [
    HealthCenter, { provide: PLATFORM_HEALTH, useExisting: HealthCenter },
    AuditCenter, { provide: AUDIT_CENTER, useExisting: AuditCenter },
    SecurityCenter, { provide: SECURITY_CENTER, useExisting: SecurityCenter },
    ObservabilityEngine, { provide: OBSERVABILITY_ENGINE, useExisting: ObservabilityEngine },
    DiagnosticsEngine, { provide: DIAGNOSTICS_ENGINE, useExisting: DiagnosticsEngine },
    OperationalReadiness, { provide: OPERATIONAL_READINESS, useExisting: OperationalReadiness },
    DeploymentManager, { provide: DEPLOYMENT_MANAGER, useExisting: DeploymentManager },
    BackupManager, { provide: BACKUP_MANAGER, useExisting: BackupManager },
    PlatformOperations, { provide: PLATFORM_OPS, useExisting: PlatformOperations },
  ],
})
export class PlatformOperationsModule {}
