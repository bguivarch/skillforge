/**
 * R2 config URL - set via VITE_CONFIG_URL in .env
 */
export const CONFIG_URL = import.meta.env.VITE_CONFIG_URL as string;

/**
 * Claude.ai API base URL
 */
export const CLAUDE_API_BASE = 'https://claude.ai/api';

/**
 * API endpoints
 */
export const ENDPOINTS = {
  listSkills: (orgId: string) =>
    `${CLAUDE_API_BASE}/organizations/${orgId}/skills/list-skills`,
  createSkill: (orgId: string) =>
    `${CLAUDE_API_BASE}/organizations/${orgId}/skills/create-simple-skill`,
  uploadSkill: (orgId: string, overwrite: boolean = false) =>
    `${CLAUDE_API_BASE}/organizations/${orgId}/skills/upload-skill${overwrite ? '?overwrite=true' : ''}`,
  enableSkill: (orgId: string) =>
    `${CLAUDE_API_BASE}/organizations/${orgId}/skills/enable-skill`,
  disableSkill: (orgId: string) =>
    `${CLAUDE_API_BASE}/organizations/${orgId}/skills/disable-skill`,
} as const;

/**
 * Cookie names
 */
export const COOKIE_NAMES = {
  lastActiveOrg: 'lastActiveOrg',
} as const;

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  lastSyncTime: 'lastSyncTime',
  syncResults: 'syncResults',
  cachedSkills: 'cachedSkills',
  cachedConfig: 'cachedConfig',
  managedSkills: 'managedSkills',
  pendingCounts: 'pendingCounts',
} as const;
