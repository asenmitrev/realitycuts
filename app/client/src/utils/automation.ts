// Re-export shared automation utilities for frontend use
export { getAutomationLimits, canCreateAutomation, getRemainingAutomationSlots } from 'shared/utils/automation';

export type { AutomationLimits, Entitlement } from 'shared/utils/automation';

export interface AutomationLimitsResponse {
  limits: { daily: number; weekly: number };
  current: { daily: number; weekly: number };
  remaining: { daily: number; weekly: number };
  canCreateDaily: boolean;
  canCreateWeekly: boolean;
}
