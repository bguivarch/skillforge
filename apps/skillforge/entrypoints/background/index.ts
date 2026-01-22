import { defineBackground } from 'wxt/sandbox';
import type { AuthResponse, Message, StatusResponse, SyncEngineResult, SyncResult } from '../../lib/types';
import {
  cachedConfigItem,
  cachedSkillsItem,
  getManagedSkills,
  lastSyncTimeItem,
  syncResultsItem,
} from '../../lib/storage';
import { getOrganizationId, isUserLoggedIn, listSkills, toggleSkill } from './api-client';
import {
  getSkillStates,
  getPendingCounts,
  runSync,
  syncSingleSkill,
  updateBadge,
  updatePendingCounts,
} from './sync-engine';
import { fetchConfig } from '../../lib/config-loader';

export default defineBackground(() => {
  console.log('[SkillForge] Background service worker started');

  // Listen for messages from popup
  browser.runtime.onMessage.addListener((message: unknown) => {
    return handleMessage(message as Message);
  });

  // Initialize badge on startup
  updateBadge();

  // Periodically check for updates (every 30 minutes)
  setInterval(async () => {
    try {
      const orgId = await getOrganizationId();
      if (orgId) {
        const config = await fetchConfig();
        await cachedConfigItem.setValue(config);

        const skills = await listSkills(orgId);
        await cachedSkillsItem.setValue(skills);

        await updatePendingCounts();
        await updateBadge();
      }
    } catch (error) {
      console.error('[SkillForge] Periodic update failed:', error);
    }
  }, 30 * 60 * 1000);
});

/**
 * Handle messages from popup
 */
async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'CHECK_AUTH':
      return handleCheckAuth();

    case 'GET_STATUS':
      return handleGetStatus();

    case 'SYNC_SKILLS':
      return handleSyncSkills();

    case 'SYNC_SINGLE_SKILL':
      return handleSyncSingleSkill(message.skillName);

    case 'TOGGLE_SKILL':
      return handleToggleSkill(message.skillId, message.enabled);

    case 'GET_PENDING':
      return getPendingCounts();

    default:
      console.warn('[SkillForge] Unknown message type:', message);
      return { error: 'Unknown message type' };
  }
}

/**
 * Check authentication status
 */
async function handleCheckAuth(): Promise<AuthResponse> {
  const orgId = await getOrganizationId();
  return {
    loggedIn: orgId !== null,
    orgId,
  };
}

/**
 * Get current status for popup
 */
async function handleGetStatus(): Promise<StatusResponse> {
  const loggedIn = await isUserLoggedIn();

  if (!loggedIn) {
    return {
      loggedIn: false,
      config: null,
      skills: [],
      lastSyncTime: null,
      syncResults: [],
      pendingCounts: { newCount: 0, updateCount: 0 },
    };
  }

  // Try to refresh data
  const orgId = await getOrganizationId();
  let skills = await cachedSkillsItem.getValue();
  let config = await cachedConfigItem.getValue();

  // Fetch fresh data if we have an org ID
  if (orgId) {
    try {
      skills = await listSkills(orgId);
      await cachedSkillsItem.setValue(skills);
    } catch (error) {
      console.error('[SkillForge] Failed to fetch skills:', error);
    }

    try {
      config = await fetchConfig();
      await cachedConfigItem.setValue(config);
    } catch (error) {
      console.error('[SkillForge] Failed to fetch config:', error);
    }
  }

  const managedSkills = await getManagedSkills();
  const skillsWithState = await getSkillStates(skills, config, managedSkills);

  await updatePendingCounts();
  await updateBadge();

  return {
    loggedIn: true,
    config,
    skills: skillsWithState,
    lastSyncTime: await lastSyncTimeItem.getValue(),
    syncResults: await syncResultsItem.getValue(),
    pendingCounts: await getPendingCounts(),
  };
}

/**
 * Run full skill sync
 */
async function handleSyncSkills(): Promise<SyncEngineResult> {
  const result = await runSync();
  await updateBadge();
  return result;
}

/**
 * Sync a single skill by name
 */
async function handleSyncSingleSkill(skillName: string): Promise<SyncResult> {
  const result = await syncSingleSkill(skillName);
  await updateBadge();
  return result;
}

/**
 * Toggle skill enabled state
 */
async function handleToggleSkill(skillId: string, enabled: boolean): Promise<void> {
  const orgId = await getOrganizationId();
  if (!orgId) {
    throw new Error('Not logged in');
  }

  await toggleSkill(orgId, skillId, enabled);

  // Refresh skills cache
  const skills = await listSkills(orgId);
  await cachedSkillsItem.setValue(skills);
}
