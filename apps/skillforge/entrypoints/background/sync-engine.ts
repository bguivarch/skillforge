import type {
  ClaudeSkill,
  ManagedSkill,
  SkillConfig,
  SkillState,
  SkillWithState,
  SyncEngineResult,
  SyncResult,
  SkillsConfig,
} from '../../lib/types';
import {
  fetchConfig,
  resolveSkillContent,
  hashContent,
  ConfigError,
} from '../../lib/config-loader';
import {
  cachedConfigItem,
  cachedSkillsItem,
  getManagedSkills,
  lastSyncTimeItem,
  managedSkillsItem,
  pendingCountItem,
  setManagedSkill,
  syncResultsItem,
} from '../../lib/storage';
import {
  getOrganizationId,
  listSkills,
  createSkill,
  disableSkill,
  ClaudeApiError,
} from './api-client';

/**
 * Run full skill sync from R2 config to Claude.ai
 */
export async function runSync(): Promise<SyncEngineResult> {
  const results: SyncResult[] = [];

  try {
    // 1. Get organization ID
    const orgId = await getOrganizationId();
    if (!orgId) {
      return {
        success: false,
        results: [],
        error: 'Not logged in to Claude.ai. Please log in and try again.',
      };
    }

    // 2. Fetch config from R2
    let config: SkillsConfig;
    try {
      config = await fetchConfig();
    } catch (error) {
      if (error instanceof ConfigError) {
        return {
          success: false,
          results: [],
          error: error.message,
        };
      }
      throw error;
    }

    // 3. Get existing skills from Claude.ai
    const existingSkills = await listSkills(orgId);
    const existingByName = new Map(existingSkills.map(s => [s.name.toLowerCase(), s]));

    // 4. Get managed skills from storage
    const managedSkills = await getManagedSkills();

    // 5. Process each skill from config
    for (const skillConfig of config.skills) {
      const skillNameLower = skillConfig.name.toLowerCase();
      const existing = existingByName.get(skillNameLower);

      try {
        // Resolve skill content (fetch from source if needed)
        const content = await resolveSkillContent(skillConfig);
        const newHash = await hashContent(content.instructions);

        if (existing) {
          // Skill already exists
          const managed = managedSkills[skillConfig.name];

          if (managed && managed.contentHash === newHash) {
            // No changes
            results.push({
              skillName: skillConfig.name,
              action: 'skipped',
              message: 'Already up to date',
            });
          } else {
            // Content changed - update managed record
            // Note: Claude.ai may not support updating skills, so we just track the change
            await setManagedSkill(skillConfig.name, newHash);
            results.push({
              skillName: skillConfig.name,
              action: 'skipped',
              message: managed ? 'Content changed (manual update required)' : 'Already exists',
            });
          }
        } else {
          // Create new skill
          const created = await createSkill(orgId, content);

          // Track as managed
          await setManagedSkill(skillConfig.name, newHash);

          // Disable if enabledByDefault is false
          if (skillConfig.enabledByDefault === false) {
            try {
              await disableSkill(orgId, created.id);
            } catch (e) {
              console.warn('[SkillForge] Failed to disable skill:', e);
            }
          }

          results.push({
            skillName: skillConfig.name,
            action: 'created',
          });
        }
      } catch (error) {
        results.push({
          skillName: skillConfig.name,
          action: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 6. Refresh skills list after sync
    const updatedSkills = await listSkills(orgId);

    // 7. Update storage
    await Promise.all([
      lastSyncTimeItem.setValue(Date.now()),
      syncResultsItem.setValue(results),
      cachedSkillsItem.setValue(updatedSkills),
      cachedConfigItem.setValue(config),
    ]);

    // 8. Update pending count
    await updatePendingCount();

    return {
      success: true,
      results,
    };
  } catch (error) {
    if (error instanceof ClaudeApiError && error.isAuthError) {
      return {
        success: false,
        results,
        error: 'Authentication failed. Please log in to Claude.ai.',
      };
    }

    return {
      success: false,
      results,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Get skill states for all skills
 */
export async function getSkillStates(
  claudeSkills: ClaudeSkill[],
  config: SkillsConfig | null,
  managedSkills: Record<string, ManagedSkill>
): Promise<SkillWithState[]> {
  const result: SkillWithState[] = [];
  const configByName = new Map(
    config?.skills.map(s => [s.name.toLowerCase(), s]) ?? []
  );

  for (const skill of claudeSkills) {
    const skillNameLower = skill.name.toLowerCase();
    const managed = managedSkills[skill.name];
    const skillConfig = configByName.get(skillNameLower);

    let state: SkillState;

    if (managed) {
      if (skillConfig) {
        // In managed list and in config
        // Check if content hash matches (would need to fetch and compare)
        // For now, assume managed = up to date
        state = 'managed';
      } else {
        // In managed list but not in config - orphaned
        state = 'orphaned';
      }
    } else {
      if (skillConfig) {
        // In config but not managed - should be synced
        state = 'other';
      } else {
        // Not in managed list and not in config - user's own skill
        state = 'other';
      }
    }

    result.push({
      skill,
      state,
      config: skillConfig,
      managedSkill: managed,
    });
  }

  return result;
}

/**
 * Calculate and update pending count
 */
export async function updatePendingCount(): Promise<number> {
  try {
    const orgId = await getOrganizationId();
    if (!orgId) {
      await pendingCountItem.setValue(0);
      return 0;
    }

    const config = await cachedConfigItem.getValue();
    if (!config) {
      await pendingCountItem.setValue(0);
      return 0;
    }

    const existingSkills = await cachedSkillsItem.getValue();
    const existingNames = new Set(existingSkills.map(s => s.name.toLowerCase()));
    const managedSkills = await getManagedSkills();

    let pending = 0;

    for (const skillConfig of config.skills) {
      const exists = existingNames.has(skillConfig.name.toLowerCase());
      const managed = managedSkills[skillConfig.name];

      if (!exists) {
        // New skill available
        pending++;
      } else if (managed) {
        // Check if outdated (simplified - would need hash comparison)
        // For now, we don't count updates as pending
      }
    }

    await pendingCountItem.setValue(pending);
    return pending;
  } catch (error) {
    console.error('[SkillForge] Failed to update pending count:', error);
    return 0;
  }
}

/**
 * Get current pending count
 */
export async function getPendingCount(): Promise<number> {
  return pendingCountItem.getValue();
}

/**
 * Update extension badge with pending count
 */
export async function updateBadge(): Promise<void> {
  const count = await getPendingCount();

  if (count > 0) {
    await browser.action.setBadgeText({ text: String(count) });
    await browser.action.setBadgeBackgroundColor({ color: '#3b82f6' }); // blue
  } else {
    await browser.action.setBadgeText({ text: '' });
  }
}
