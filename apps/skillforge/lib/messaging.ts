import type { AuthResponse, StatusResponse, SyncEngineResult } from './types';

/**
 * Check if user is logged into Claude.ai
 */
export async function checkAuth(): Promise<AuthResponse> {
  return browser.runtime.sendMessage({ type: 'CHECK_AUTH' });
}

/**
 * Get current status (skills, config, sync state)
 */
export async function getStatus(): Promise<StatusResponse> {
  return browser.runtime.sendMessage({ type: 'GET_STATUS' });
}

/**
 * Trigger skill sync
 */
export async function triggerSync(): Promise<SyncEngineResult> {
  return browser.runtime.sendMessage({ type: 'SYNC_SKILLS' });
}

/**
 * Toggle skill enabled/disabled state
 */
export async function toggleSkill(skillId: string, enabled: boolean): Promise<void> {
  return browser.runtime.sendMessage({ type: 'TOGGLE_SKILL', skillId, enabled });
}

/**
 * Get pending skills count
 */
export async function getPendingCount(): Promise<number> {
  return browser.runtime.sendMessage({ type: 'GET_PENDING' });
}
