import type { AuthResponse, PendingCounts, StatusResponse, SyncEngineResult, SyncResult } from './types';

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
 * Trigger full sync
 */
export async function triggerSync(): Promise<SyncEngineResult> {
  return browser.runtime.sendMessage({ type: 'SYNC' });
}

/**
 * Sync a single skill by name
 */
export async function syncSingleSkill(skillName: string): Promise<SyncResult> {
  return browser.runtime.sendMessage({ type: 'SYNC_SINGLE_SKILL', skillName });
}

/**
 * Toggle skill enabled/disabled state
 */
export async function toggleSkill(skillId: string, enabled: boolean): Promise<void> {
  return browser.runtime.sendMessage({ type: 'TOGGLE_SKILL', skillId, enabled });
}

/**
 * Delete a skill
 */
export async function deleteSkill(skillId: string, skillName: string): Promise<void> {
  return browser.runtime.sendMessage({ type: 'DELETE_SKILL', skillId, skillName });
}

/**
 * Delete a connector
 */
export async function deleteConnector(connectorId: string, connectorName: string): Promise<void> {
  return browser.runtime.sendMessage({ type: 'DELETE_CONNECTOR', connectorId, connectorName });
}

/**
 * Get pending skills counts
 */
export async function getPendingCounts(): Promise<PendingCounts> {
  return browser.runtime.sendMessage({ type: 'GET_PENDING' });
}
