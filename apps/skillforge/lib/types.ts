/**
 * Connector config from R2
 */
export interface ConnectorConfig {
  name: string;
  url: string;
  description?: string;
}

/**
 * Connector from Claude.ai API
 */
export interface ClaudeConnector {
  id: string;
  uuid: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tracked connector installed by SkillForge
 */
export interface ManagedConnector {
  name: string;
  url: string;
  connectorId: string;
  installedAt: number;
  updatedAt: number;
}

/**
 * Connector lifecycle state
 */
export type ConnectorState = 'managed' | 'orphaned' | 'other';

/**
 * Connector with computed state for UI
 */
export interface ConnectorWithState {
  connector: ClaudeConnector;
  state: ConnectorState;
  config?: ConnectorConfig;
  managedConnector?: ManagedConnector;
}

/**
 * Sync result for a single connector
 */
export interface ConnectorSyncResult {
  connectorName: string;
  action: 'created' | 'skipped' | 'error';
  message?: string;
}

/**
 * Skill definition from remote config
 */
export interface SkillConfig {
  name: string;
  version: string;
  description: string;
  source: string;
  connectors?: string[];
  enabledByDefault?: boolean;
  allowUserToggle?: boolean;
}

/**
 * Full config structure from R2
 */
export interface SkillsConfig {
  name: string;
  version: string;
  connectors?: ConnectorConfig[];
  skills: SkillConfig[];
}

/**
 * Resolved skill content (after fetching source)
 * Can be either simple (instructions only) or complex (pre-packaged .skill file)
 */
export interface SkillContent {
  name: string;
  description: string;
  instructions: string;
  /**
   * Pre-packaged .skill file blob (for complex skills with multiple files)
   * When present, this is uploaded directly instead of creating a new ZIP
   */
  skillFileBlob?: Blob;
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
  version: string;
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
  connectorResults: ConnectorSyncResult[];
  error?: string;
}

/**
 * Pending counts for new and updated skills
 */
export interface PendingCounts {
  newCount: number;
  updateCount: number;
  newSkillNames: string[];
  updatedSkillNames: string[];
  newConnectorCount: number;
  newConnectorNames: string[];
}

/**
 * Status response for UI
 */
export interface StatusResponse {
  loggedIn: boolean;
  config: SkillsConfig | null;
  skills: SkillWithState[];
  connectors: ConnectorWithState[];
  lastSyncTime: number | null;
  syncResults: SyncResult[];
  connectorSyncResults: ConnectorSyncResult[];
  pendingCounts: PendingCounts;
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
  | { type: 'SYNC' }
  | { type: 'SYNC_SINGLE_SKILL'; skillName: string }
  | { type: 'TOGGLE_SKILL'; skillId: string; enabled: boolean }
  | { type: 'DELETE_SKILL'; skillId: string; skillName: string }
  | { type: 'DELETE_CONNECTOR'; connectorId: string; connectorName: string }
  | { type: 'GET_PENDING' };
