import { Module } from '@nestjs/common';
import { PLUGIN_MANAGER, PERMISSION_MANAGER, PLATFORM_SDK } from './contracts/platform-sdk.interface';
import { PluginManager, PermissionManager, PlatformSDK } from './engines/platform-sdk-engines.service';
import { PlatformSDKController } from './platform-sdk.controller';

@Module({
  controllers: [PlatformSDKController],
  providers: [
    PluginManager, { provide: PLUGIN_MANAGER, useExisting: PluginManager },
    PermissionManager, { provide: PERMISSION_MANAGER, useExisting: PermissionManager },
    PlatformSDK, { provide: PLATFORM_SDK, useExisting: PlatformSDK },
  ],
})
export class PlatformSDKModule {}
