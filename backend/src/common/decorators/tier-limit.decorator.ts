import { SetMetadata } from '@nestjs/common';

export type TierLimitKey =
  | 'maxUsers'
  | 'maxAgents'
  | 'maxDepartments'
  | 'maxStorageGB'
  | 'maxApiCalls'
  | 'maxConversationMessages'
  | 'maxFileSizeMB';

export const TIER_LIMIT_KEY = 'tierLimit';

export const TierLimit = (key: TierLimitKey) => SetMetadata(TIER_LIMIT_KEY, key);