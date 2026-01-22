import { storage } from 'wxt/storage';
import type { ClaudeSkill, ManagedSkill, SkillsConfig, SyncResult } from './types';
import { STORAGE_KEYS } from './constants';

/**
 * Last sync timestamp
 */
export const lastSyncTimeItem = storage.defineItem<number | null>(
  `local:${STORAGE_KEYS.lastSyncTime}`,
  { fallback: null }
);

/**
 * Last sync results
 */
export const syncResultsItem = storage.defineItem<SyncResult[]>(
  `local:${STORAGE_KEYS.syncResults}`,
  { fallback: [] }
);

/**
 * Cached skills from Claude.ai API
 */
export const cachedSkillsItem = storage.defineItem<ClaudeSkill[]>(
  `local:${STORAGE_KEYS.cachedSkills}`,
  { fallback: [] }
);

/**
 * Cached config from R2
 */
export const cachedConfigItem = storage.defineItem<SkillsConfig | null>(
  `local:${STORAGE_KEYS.cachedConfig}`,
  { fallback: null }
);

/**
 * Map of skills installed by SkillForge with content hash
 */
export const managedSkillsItem = storage.defineItem<Record<string, ManagedSkill>>(
  `local:${STORAGE_KEYS.managedSkills}`,
  { fallback: {} }
);

/**
 * Number of skills pending sync
 */
export const pendingCountItem = storage.defineItem<number>(
  `local:${STORAGE_KEYS.pendingCount}`,
  { fallback: 0 }
);

/**
 * Update sync status after a sync operation
 */
export async function updateSyncStatus(
  results: SyncResult[],
  skills: ClaudeSkill[],
  config: SkillsConfig
): Promise<void> {
  await Promise.all([
    lastSyncTimeItem.setValue(Date.now()),
    syncResultsItem.setValue(results),
    cachedSkillsItem.setValue(skills),
    cachedConfigItem.setValue(config),
  ]);
}

/**
 * Add or update a managed skill
 */
export async function setManagedSkill(
  name: string,
  contentHash: string
): Promise<void> {
  const managed = await managedSkillsItem.getValue();
  const now = Date.now();

  if (managed[name]) {
    managed[name].contentHash = contentHash;
    managed[name].updatedAt = now;
  } else {
    managed[name] = {
      name,
      contentHash,
      installedAt: now,
      updatedAt: now,
    };
  }

  await managedSkillsItem.setValue(managed);
}

/**
 * Get all managed skills
 */
export async function getManagedSkills(): Promise<Record<string, ManagedSkill>> {
  return managedSkillsItem.getValue();
}
