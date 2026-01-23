import JSZip from 'jszip';
import type { ClaudeConnector, ClaudeSkill, SkillContent } from '../../lib/types';
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
 * If skillFileBlob is available, uses upload-skill endpoint to preserve full .skill structure
 * Otherwise falls back to create-simple-skill JSON endpoint
 */
export async function createSkill(
  orgId: string,
  skill: SkillContent
): Promise<ClaudeSkill> {
  // If we have a pre-packaged .skill file, use upload endpoint to preserve all files
  if (skill.skillFileBlob) {
    const url = ENDPOINTS.uploadSkill(orgId, false); // overwrite=false for new skills

    const skillFile = new File([skill.skillFileBlob], `${skill.name}.skill`, {
      type: 'application/octet-stream',
    });

    const formData = new FormData();
    formData.append('file', skillFile);

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const isAuth = response.status === 401 || response.status === 403;
      throw new ClaudeApiError(
        `Failed to create skill: ${response.status} ${response.statusText}`,
        response.status,
        isAuth
      );
    }

    const text = await response.text();
    if (!text) {
      throw new ClaudeApiError('Empty response from upload-skill endpoint');
    }

    return JSON.parse(text);
  }

  // Fallback: simple skill via JSON endpoint
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
 * Delete a skill
 */
export async function deleteSkill(orgId: string, skillId: string): Promise<void> {
  const url = ENDPOINTS.deleteSkill(orgId);
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

/**
 * Create a .skill file (ZIP containing {name}/SKILL.md)
 * Uses Unix platform and no directory entries to match Claude's expected format
 */
async function createSkillFile(skill: SkillContent): Promise<Blob> {
  const zip = new JSZip();

  // Create the skill content with frontmatter
  const skillContent = `---
name: ${skill.name}
description: ${skill.description}
---

${skill.instructions}`;

  // Add to zip as {skillName}/SKILL.md
  // IMPORTANT: createFolders: false to avoid explicit directory entries
  zip.file(`${skill.name}/SKILL.md`, skillContent, { createFolders: false });

  // Use platform: 'UNIX' to match Claude's expected format
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
}

/**
 * Update an existing skill using upload-skill endpoint with overwrite
 */
export async function updateSkill(
  orgId: string,
  skill: SkillContent
): Promise<ClaudeSkill> {
  const url = ENDPOINTS.uploadSkill(orgId, true);

  // Use pre-packaged .skill file if available, otherwise create one
  let skillBlob: Blob;
  if (skill.skillFileBlob) {
    // Use the pre-packaged .skill file directly
    skillBlob = skill.skillFileBlob;
  } else {
    // Create a simple .skill ZIP file
    skillBlob = await createSkillFile(skill);
  }

  const skillFile = new File([skillBlob], `${skill.name}.skill`, {
    type: 'application/octet-stream',
  });

  // Build multipart form data
  const formData = new FormData();
  formData.append('file', skillFile);
  formData.append('overwrite', 'true');

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Note: Don't set Content-Type header - browser will set it with boundary
  });

  if (!response.ok) {
    const isAuth = response.status === 401 || response.status === 403;
    throw new ClaudeApiError(
      `Failed to update skill: ${response.status} ${response.statusText}`,
      response.status,
      isAuth
    );
  }

  const text = await response.text();
  if (!text) {
    throw new ClaudeApiError('Empty response from upload-skill endpoint');
  }

  return JSON.parse(text);
}

/**
 * List all MCP connectors for the organization
 */
export async function listConnectors(orgId: string): Promise<ClaudeConnector[]> {
  const url = ENDPOINTS.listConnectors(orgId);
  const response = await apiRequest<ClaudeConnector[]>(url);
  return response ?? [];
}

/**
 * Create a new MCP connector
 */
export async function createConnector(
  orgId: string,
  name: string,
  url: string
): Promise<ClaudeConnector> {
  const endpoint = ENDPOINTS.createConnector(orgId);
  return apiRequest<ClaudeConnector>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ name, url }),
  });
}

/**
 * Delete an MCP connector
 */
export async function deleteConnector(
  orgId: string,
  connectorId: string
): Promise<void> {
  const url = ENDPOINTS.deleteConnector(orgId, connectorId);
  await apiRequest(url, {
    method: 'DELETE',
  });
}
