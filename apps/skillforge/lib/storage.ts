import { storage } from 'wxt/storage';
import type { ClaudeSkill, ManagedSkill, PendingCounts, SkillsConfig, SyncResult } from './types';
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
 * Counts of new and updated skills pending sync
 */
export const pendingCountsItem = storage.defineItem<PendingCounts>(
  `local:${STORAGE_KEYS.pendingCounts}`,
  { fallback: { newCount: 0, updateCount: 0 } }
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
  version: string,
  contentHash: string
): Promise<void> {
  const managed = await managedSkillsItem.getValue();
  const now = Date.now();

  if (managed[name]) {
    managed[name].version = version;
    managed[name].contentHash = contentHash;
    managed[name].updatedAt = now;
  } else {
    managed[name] = {
      name,
      version,
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

/**
 * Remove a managed skill from tracking
 */
export async function removeManagedSkill(name: string): Promise<void> {
  const managed = await managedSkillsItem.getValue();
  delete managed[name];
  await managedSkillsItem.setValue(managed);
}
