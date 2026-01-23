import type {
  ClaudeConnector,
  ClaudeSkill,
  ConnectorConfig,
  ConnectorState,
  ConnectorSyncResult,
  ConnectorWithState,
  ManagedConnector,
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
  cachedConnectorsItem,
  cachedSkillsItem,
  connectorSyncResultsItem,
  getManagedConnectors,
  getManagedSkills,
  lastSyncTimeItem,
  managedSkillsItem,
  pendingCountsItem,
  setManagedConnector,
  setManagedSkill,
  syncResultsItem,
} from '../../lib/storage';
import {
  createConnector,
  getOrganizationId,
  listConnectors,
  listSkills,
  createSkill,
  updateSkill,
  disableSkill,
  ClaudeApiError,
} from './api-client';
import { trackEvent } from '../../lib/tracking';

/**
 * Sync connectors from config to Claude.ai
 */
async function syncConnectors(
  orgId: string,
  connectorConfigs: ConnectorConfig[]
): Promise<ConnectorSyncResult[]> {
  const results: ConnectorSyncResult[] = [];

  if (!connectorConfigs || connectorConfigs.length === 0) {
    return results;
  }

  // Get existing connectors from Claude.ai
  const existingConnectors = await listConnectors(orgId);
  const existingByUrl = new Map(existingConnectors.map(c => [c.url, c]));
  const existingByName = new Map(existingConnectors.map(c => [c.name.toLowerCase(), c]));

  // Get managed connectors from storage
  const managedConnectors = await getManagedConnectors();

  for (const connectorConfig of connectorConfigs) {
    try {
      // Check if URL already exists
      const existingByUrlMatch = existingByUrl.get(connectorConfig.url);
      if (existingByUrlMatch) {
        // URL exists - track as managed and skip (use uuid as the ID)
        const connectorId = existingByUrlMatch.uuid || existingByUrlMatch.id;
        await setManagedConnector(
          connectorConfig.name,
          connectorConfig.url,
          connectorId
        );
        results.push({
          connectorName: connectorConfig.name,
          action: 'skipped',
          message: 'Already installed',
        });
        continue;
      }

      // Check if name exists with different URL
      const existingByNameMatch = existingByName.get(connectorConfig.name.toLowerCase());
      if (existingByNameMatch && existingByNameMatch.url !== connectorConfig.url) {
        results.push({
          connectorName: connectorConfig.name,
          action: 'skipped',
          message: 'Name conflict: connector exists with different URL',
        });
        continue;
      }

      // Create new connector
      const created = await createConnector(orgId, connectorConfig.name, connectorConfig.url);

      // Track as managed (use uuid as the ID)
      const createdId = created.uuid || created.id;
      await setManagedConnector(connectorConfig.name, connectorConfig.url, createdId);

      results.push({
        connectorName: connectorConfig.name,
        action: 'created',
      });
    } catch (error) {
      results.push({
        connectorName: connectorConfig.name,
        action: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Run full skill sync from R2 config to Claude.ai
 */
export async function runSync(): Promise<SyncEngineResult> {
  const results: SyncResult[] = [];
  const connectorResults: ConnectorSyncResult[] = [];

  try {
    // 1. Get organization ID
    const orgId = await getOrganizationId();
    if (!orgId) {
      return {
        success: false,
        results: [],
        connectorResults: [],
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
          connectorResults: [],
          error: error.message,
        };
      }
      throw error;
    }

    // 3. Sync connectors FIRST (dependencies before dependents)
    if (config.connectors && config.connectors.length > 0) {
      const syncedConnectorResults = await syncConnectors(orgId, config.connectors);
      connectorResults.push(...syncedConnectorResults);
    }

    // 4. Get existing skills from Claude.ai
    const existingSkills = await listSkills(orgId);
    const existingByName = new Map(existingSkills.map(s => [s.name.toLowerCase(), s]));

    // 5. Get managed skills from storage
    const managedSkills = await getManagedSkills();

    // 6. Get available connectors for dependency checking
    const availableConnectors = await listConnectors(orgId);
    const availableConnectorNames = new Set(availableConnectors.map(c => c.name.toLowerCase()));

    // 7. Process each skill from config
    for (const skillConfig of config.skills) {
      const skillNameLower = skillConfig.name.toLowerCase();
      const existing = existingByName.get(skillNameLower);

      try {
        // Check connector dependencies
        if (skillConfig.connectors && skillConfig.connectors.length > 0) {
          const missingConnectors = skillConfig.connectors.filter(
            c => !availableConnectorNames.has(c.toLowerCase())
          );

          if (missingConnectors.length > 0) {
            results.push({
              skillName: skillConfig.name,
              action: 'error',
              message: `Missing connectors: ${missingConnectors.join(', ')}`,
            });
            continue;
          }
        }

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

          // Track skill creation
          trackEvent('skill_imported');

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

    // 8. Refresh skills and connectors list after sync
    const updatedSkills = await listSkills(orgId);
    const updatedConnectors = await listConnectors(orgId);

    // 9. Update storage
    await Promise.all([
      lastSyncTimeItem.setValue(Date.now()),
      syncResultsItem.setValue(results),
      connectorSyncResultsItem.setValue(connectorResults),
      cachedSkillsItem.setValue(updatedSkills),
      cachedConnectorsItem.setValue(updatedConnectors),
      cachedConfigItem.setValue(config),
    ]);

    // 10. Update pending counts
    await updatePendingCounts();

    return {
      success: true,
      results,
      connectorResults,
    };
  } catch (error) {
    if (error instanceof ClaudeApiError && error.isAuthError) {
      return {
        success: false,
        results,
        connectorResults,
        error: 'Authentication failed. Please log in to Claude.ai.',
      };
    }

    return {
      success: false,
      results,
      connectorResults,
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

    // 5. Resolve skill content
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

      // Track skill creation
      trackEvent('skill_imported');

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
  const zeroCounts: PendingCounts = {
    newCount: 0,
    updateCount: 0,
    newSkillNames: [],
    updatedSkillNames: [],
    newConnectorCount: 0,
    newConnectorNames: [],
  };

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

    // Check for pending connectors
    const existingConnectors = await cachedConnectorsItem.getValue();
    const existingConnectorUrls = new Set(existingConnectors.map(c => c.url));
    const newConnectorNames: string[] = [];

    if (config.connectors) {
      for (const connectorConfig of config.connectors) {
        if (!existingConnectorUrls.has(connectorConfig.url)) {
          newConnectorNames.push(connectorConfig.name);
        }
      }
    }

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
      newConnectorCount: newConnectorNames.length,
      newConnectorNames,
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
 * Get connector states for all connectors
 */
export async function getConnectorStates(
  claudeConnectors: ClaudeConnector[],
  config: SkillsConfig | null,
  managedConnectors: Record<string, ManagedConnector>
): Promise<ConnectorWithState[]> {
  const result: ConnectorWithState[] = [];
  const configByName = new Map(
    config?.connectors?.map(c => [c.name.toLowerCase(), c]) ?? []
  );
  const configByUrl = new Map(
    config?.connectors?.map(c => [c.url, c]) ?? []
  );

  for (const connector of claudeConnectors) {
    const connectorNameLower = connector.name.toLowerCase();
    // Use uuid as the primary ID (Claude.ai API uses uuid)
    const connectorId = connector.uuid || connector.id;

    // Check if managed by matching connector ID or URL (must have valid values to match)
    const managed = Object.values(managedConnectors).find(
      m => (connectorId && m.connectorId === connectorId) ||
           (connector.url && m.url === connector.url)
    );

    // Check if in config by name or URL
    const connectorConfig = configByName.get(connectorNameLower) ??
      configByUrl.get(connector.url);

    let state: ConnectorState;

    if (managed) {
      if (connectorConfig) {
        // In managed list and in config
        state = 'managed';
      } else {
        // In managed list but not in config - orphaned
        state = 'orphaned';
      }
    } else {
      // Not managed - user's own connector
      state = 'other';
    }

    result.push({
      connector,
      state,
      config: connectorConfig,
      managedConnector: managed,
    });
  }

  return result;
}

/**
 * Update extension badge with total pending count
 */
export async function updateBadge(): Promise<void> {
  const counts = await getPendingCounts();
  const total = counts.newCount + counts.updateCount + counts.newConnectorCount;

  if (total > 0) {
    await browser.action.setBadgeText({ text: String(total) });
    await browser.action.setBadgeBackgroundColor({ color: '#3b82f6' }); // blue
  } else {
    await browser.action.setBadgeText({ text: '' });
  }
}
