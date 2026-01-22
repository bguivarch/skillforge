import type { ClaudeSkill, SkillContent } from '../../lib/types';
import { ENDPOINTS, COOKIE_NAMES } from '../../lib/constants';

/**
 * Error thrown when Claude.ai API calls fail
 */
export class ClaudeApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isAuthError: boolean = false
  ) {
    super(message);
    this.name = 'ClaudeApiError';
  }
}

/**
 * Get organization ID from lastActiveOrg cookie
 */
export async function getOrganizationId(): Promise<string | null> {
  try {
    const cookie = await browser.cookies.get({
      url: 'https://claude.ai',
      name: COOKIE_NAMES.lastActiveOrg,
    });
    return cookie?.value ?? null;
  } catch (error) {
    console.error('[SkillForge] Failed to read org cookie:', error);
    return null;
  }
}

/**
 * Check if user is logged into Claude.ai
 */
export async function isUserLoggedIn(): Promise<boolean> {
  const orgId = await getOrganizationId();
  return orgId !== null;
}

/**
 * Make authenticated API request to Claude.ai
 */
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const isAuth = response.status === 401 || response.status === 403;
    throw new ClaudeApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      isAuth
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text);
}

/**
 * List all skills for the organization
 */
export async function listSkills(orgId: string): Promise<ClaudeSkill[]> {
  const url = ENDPOINTS.listSkills(orgId);
  const response = await apiRequest<{ skills?: ClaudeSkill[] }>(url);
  return response.skills ?? [];
}

/**
 * Create a new skill
 */
export async function createSkill(
  orgId: string,
  skill: SkillContent
): Promise<ClaudeSkill> {
  const url = ENDPOINTS.createSkill(orgId);
  return apiRequest<ClaudeSkill>(url, {
    method: 'POST',
    body: JSON.stringify({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
    }),
  });
}

/**
 * Enable a skill
 */
export async function enableSkill(orgId: string, skillId: string): Promise<void> {
  const url = ENDPOINTS.enableSkill(orgId);
  await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify({ skill_id: skillId }),
  });
}

/**
 * Disable a skill
 */
export async function disableSkill(orgId: string, skillId: string): Promise<void> {
  const url = ENDPOINTS.disableSkill(orgId);
  await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify({ skill_id: skillId }),
  });
}

/**
 * Toggle skill enabled state
 */
export async function toggleSkill(
  orgId: string,
  skillId: string,
  enabled: boolean
): Promise<void> {
  if (enabled) {
    await enableSkill(orgId, skillId);
  } else {
    await disableSkill(orgId, skillId);
  }
}
