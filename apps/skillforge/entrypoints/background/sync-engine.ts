import type {
  ClaudeSkill,
  ManagedSkill,
  PendingCounts,
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
  pendingCountsItem,
  setManagedSkill,
  syncResultsItem,
} from '../../lib/storage';
import {
  getOrganizationId,
  listSkills,
  createSkill,
  updateSkill,
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

          // Check if update is needed by comparing versions
          const needsUpdate = managed
            ? skillConfig.version !== managed.version
            : true; // If not managed, check content hash

          if (managed && !needsUpdate && managed.contentHash === newHash) {
            // No changes
            results.push({
              skillName: skillConfig.name,
              action: 'skipped',
              message: 'Already up to date',
            });
          } else if (needsUpdate || managed?.contentHash !== newHash) {
            // Version changed or content changed - update the skill
            try {
              await updateSkill(orgId, content);
              await setManagedSkill(skillConfig.name, skillConfig.version, newHash);
              results.push({
                skillName: skillConfig.name,
                action: 'updated',
                message: `Updated to v${skillConfig.version}`,
              });
            } catch (updateError) {
              console.warn('[SkillForge] Failed to update skill:', updateError);
              results.push({
                skillName: skillConfig.name,
                action: 'error',
                message: updateError instanceof Error ? updateError.message : 'Update failed',
              });
            }
          } else {
            // Already exists but not managed - track it
            await setManagedSkill(skillConfig.name, skillConfig.version, newHash);
            results.push({
              skillName: skillConfig.name,
              action: 'skipped',
              message: 'Already exists, now tracked',
            });
          }
        } else {
          // Create new skill
          const created = await createSkill(orgId, content);

          // Track as managed with version
          await setManagedSkill(skillConfig.name, skillConfig.version, newHash);

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
            message: `v${skillConfig.version}`,
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

    // 8. Update pending counts
    await updatePendingCounts();

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
 * Sync a single skill by name
 */
export async function syncSingleSkill(skillName: string): Promise<SyncResult> {
  try {
    // 1. Get organization ID
    const orgId = await getOrganizationId();
    if (!orgId) {
      return {
        skillName,
        action: 'error',
        message: 'Not logged in to Claude.ai',
      };
    }

    // 2. Fetch config from R2
    let config: SkillsConfig;
    try {
      config = await fetchConfig();
    } catch (error) {
      return {
        skillName,
        action: 'error',
        message: error instanceof ConfigError ? error.message : 'Failed to fetch config',
      };
    }

    // 3. Find the skill config
    const skillConfig = config.skills.find(
      s => s.name.toLowerCase() === skillName.toLowerCase()
    );
    if (!skillConfig) {
      return {
        skillName,
        action: 'error',
        message: 'Skill not found in config',
      };
    }

    // 4. Get existing skills from Claude.ai
    const existingSkills = await listSkills(orgId);
    const existing = existingSkills.find(
      s => s.name.toLowerCase() === skillName.toLowerCase()
    );

    // 5. Get managed skills from storage
    const managedSkills = await getManagedSkills();

    // 6. Resolve skill content
    const content = await resolveSkillContent(skillConfig);
    const newHash = await hashContent(content.instructions);

    let result: SyncResult;

    if (existing) {
      // Update existing skill
      try {
        await updateSkill(orgId, content);
        await setManagedSkill(skillConfig.name, skillConfig.version, newHash);
        result = {
          skillName: skillConfig.name,
          action: 'updated',
          message: `Updated to v${skillConfig.version}`,
        };
      } catch (updateError) {
        result = {
          skillName: skillConfig.name,
          action: 'error',
          message: updateError instanceof Error ? updateError.message : 'Update failed',
        };
      }
    } else {
      // Create new skill
      const created = await createSkill(orgId, content);
      await setManagedSkill(skillConfig.name, skillConfig.version, newHash);

      // Only apply enabledByDefault for NEW skills
      if (skillConfig.enabledByDefault === false) {
        try {
          await disableSkill(orgId, created.id);
        } catch (e) {
          console.warn('[SkillForge] Failed to disable skill:', e);
        }
      }

      result = {
        skillName: skillConfig.name,
        action: 'created',
        message: `v${skillConfig.version}`,
      };
    }

    // 7. Refresh skills list and update storage
    const updatedSkills = await listSkills(orgId);
    await Promise.all([
      cachedSkillsItem.setValue(updatedSkills),
      cachedConfigItem.setValue(config),
    ]);

    // 8. Update pending counts and badge
    await updatePendingCounts();
    await updateBadge();

    return result;
  } catch (error) {
    if (error instanceof ClaudeApiError && error.isAuthError) {
      return {
        skillName,
        action: 'error',
        message: 'Authentication failed. Please log in to Claude.ai.',
      };
    }

    return {
      skillName,
      action: 'error',
      message: error instanceof Error ? error.message : 'Sync failed',
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
        // In managed list and in config - check if version matches
        if (skillConfig.version !== managed.version) {
          state = 'outdated';
        } else {
          state = 'managed';
        }
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
 * Calculate and update pending counts (new skills vs updates)
 */
export async function updatePendingCounts(): Promise<PendingCounts> {
  const zeroCounts: PendingCounts = { newCount: 0, updateCount: 0, newSkillNames: [], updatedSkillNames: [] };

  try {
    const orgId = await getOrganizationId();
    if (!orgId) {
      await pendingCountsItem.setValue(zeroCounts);
      return zeroCounts;
    }

    const config = await cachedConfigItem.getValue();
    if (!config) {
      await pendingCountsItem.setValue(zeroCounts);
      return zeroCounts;
    }

    const existingSkills = await cachedSkillsItem.getValue();
    const existingNames = new Set(existingSkills.map(s => s.name.toLowerCase()));
    const managedSkills = await getManagedSkills();

    const newSkillNames: string[] = [];
    const updatedSkillNames: string[] = [];

    for (const skillConfig of config.skills) {
      const exists = existingNames.has(skillConfig.name.toLowerCase());
      const managed = managedSkills[skillConfig.name];

      if (!exists) {
        // New skill available
        newSkillNames.push(skillConfig.name);
      } else if (managed && skillConfig.version !== managed.version) {
        // Skill exists but version is outdated
        updatedSkillNames.push(skillConfig.name);
      }
    }

    const counts: PendingCounts = {
      newCount: newSkillNames.length,
      updateCount: updatedSkillNames.length,
      newSkillNames,
      updatedSkillNames,
    };
    await pendingCountsItem.setValue(counts);
    return counts;
  } catch (error) {
    console.error('[SkillForge] Failed to update pending counts:', error);
    return zeroCounts;
  }
}

/**
 * Get current pending counts
 */
export async function getPendingCounts(): Promise<PendingCounts> {
  return pendingCountsItem.getValue();
}

/**
 * Update extension badge with total pending count
 */
export async function updateBadge(): Promise<void> {
  const counts = await getPendingCounts();
  const total = counts.newCount + counts.updateCount;

  if (total > 0) {
    await browser.action.setBadgeText({ text: String(total) });
    await browser.action.setBadgeBackgroundColor({ color: '#3b82f6' }); // blue
  } else {
    await browser.action.setBadgeText({ text: '' });
  }
}
