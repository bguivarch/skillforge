/**
 * Skill definition from remote config
 */
export interface SkillConfig {
  name: string;
  description: string;
  instructions?: string;
  source?: string;
  enabledByDefault?: boolean;
  allowUserToggle?: boolean;
}

/**
 * Full config structure from R2
 */
export interface SkillsConfig {
  name: string;
  version: string;
  skills: SkillConfig[];
}

/**
 * Resolved skill content (after fetching source)
 */
export interface SkillContent {
  name: string;
  description: string;
  instructions: string;
}

/**
 * Skill from Claude.ai API
 */
export interface ClaudeSkill {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  enabled: boolean;
  creator_type: string;
  updated_at: string;
  partition_by: string;
  is_public_provisioned: boolean | null;
}

/**
 * Tracked skill installed by SkillForge
 */
export interface ManagedSkill {
  name: string;
  contentHash: string;
  installedAt: number;
  updatedAt: number;
}

/**
 * Skill lifecycle state
 */
export type SkillState = 'managed' | 'outdated' | 'orphaned' | 'other';

/**
 * Skill with computed state for UI
 */
export interface SkillWithState {
  skill: ClaudeSkill;
  state: SkillState;
  config?: SkillConfig;
  managedSkill?: ManagedSkill;
}

/**
 * Sync result for a single skill
 */
export interface SyncResult {
  skillName: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

/**
 * Overall sync engine result
 */
export interface SyncEngineResult {
  success: boolean;
  results: SyncResult[];
  error?: string;
}

/**
 * Status response for UI
 */
export interface StatusResponse {
  loggedIn: boolean;
  config: SkillsConfig | null;
  skills: SkillWithState[];
  lastSyncTime: number | null;
  syncResults: SyncResult[];
  pendingCount: number;
}

/**
 * Auth check response
 */
export interface AuthResponse {
  loggedIn: boolean;
  orgId: string | null;
}

/**
 * Message types for background/UI communication
 */
export type Message =
  | { type: 'CHECK_AUTH' }
  | { type: 'GET_STATUS' }
  | { type: 'SYNC_SKILLS' }
  | { type: 'TOGGLE_SKILL'; skillId: string; enabled: boolean }
  | { type: 'GET_PENDING' };
