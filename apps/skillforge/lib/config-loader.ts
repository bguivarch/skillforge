import JSZip from 'jszip';
import type { SkillConfig, SkillContent, SkillsConfig } from './types';
import { parseSkillMd, isSkillMdFormat } from './skill-parser';
import { CONFIG_URL } from './constants';

/**
 * Error thrown when loading config fails
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Add cache-busting query parameter to a URL
 */
function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${Date.now()}`;
}

/**
 * Fetch and validate config from R2
 */
export async function fetchConfig(): Promise<SkillsConfig> {
  let response: Response;

  try {
    response = await fetch(addCacheBuster(CONFIG_URL), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch (error) {
    throw new ConfigError(`Failed to fetch config: ${error}`);
  }

  if (!response.ok) {
    throw new ConfigError(`Failed to fetch config: ${response.status} ${response.statusText}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new ConfigError(`Invalid JSON in config: ${error}`);
  }

  // Validate structure
  if (!isValidConfig(data)) {
    throw new ConfigError('Invalid config structure: missing required fields');
  }

  return data;
}

/**
 * Validate config structure
 */
function isValidConfig(data: unknown): data is SkillsConfig {
  if (!data || typeof data !== 'object') return false;

  const config = data as Record<string, unknown>;

  if (typeof config.name !== 'string') return false;
  if (typeof config.version !== 'string') return false;
  if (!Array.isArray(config.skills)) return false;

  return config.skills.every(isValidSkillConfig);
}

/**
 * Validate individual skill config
 */
function isValidSkillConfig(skill: unknown): skill is SkillConfig {
  if (!skill || typeof skill !== 'object') return false;

  const s = skill as Record<string, unknown>;

  if (typeof s.name !== 'string' || s.name.trim() === '') return false;
  if (typeof s.description !== 'string') return false;
  if (typeof s.source !== 'string' || s.source.trim() === '') return false;

  return true;
}

/**
 * Check if a URL points to a .skill file
 */
function isSkillFileUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.toLowerCase().endsWith('.skill');
  } catch {
    return url.toLowerCase().endsWith('.skill');
  }
}

/**
 * Extract SKILL.md content from a .skill ZIP file
 */
async function extractSkillMdFromZip(blob: Blob): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(blob);

    // Find SKILL.md file (could be at root or in a subdirectory like {name}/SKILL.md)
    let skillMdFile: JSZip.JSZipObject | null = null;

    zip.forEach((relativePath, file) => {
      if (relativePath.toLowerCase().endsWith('skill.md') && !file.dir) {
        skillMdFile = file;
      }
    });

    if (skillMdFile) {
      return await (skillMdFile as JSZip.JSZipObject).async('string');
    }

    return null;
  } catch (error) {
    console.error('[SkillForge] Failed to extract SKILL.md from ZIP:', error);
    return null;
  }
}

/**
 * Resolve skill content from a pre-packaged .skill file
 */
async function resolveSkillFile(skill: SkillConfig): Promise<SkillContent> {
  let response: Response;
  try {
    response = await fetch(addCacheBuster(skill.source), {
      method: 'GET',
      cache: 'no-store',
    });
  } catch (error) {
    throw new ConfigError(`Failed to fetch skill file for "${skill.name}": ${error}`);
  }

  if (!response.ok) {
    throw new ConfigError(
      `Failed to fetch skill file for "${skill.name}": ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob();

  // Extract SKILL.md from the ZIP to get metadata
  const skillMdContent = await extractSkillMdFromZip(blob);

  if (skillMdContent && isSkillMdFormat(skillMdContent)) {
    const parsed = parseSkillMd(skillMdContent);
    return {
      name: parsed.name || skill.name,
      description: parsed.description || skill.description,
      instructions: parsed.instructions,
      skillFileBlob: blob,
    };
  }

  // Fallback: use config values if SKILL.md extraction failed
  return {
    name: skill.name,
    description: skill.description,
    instructions: skillMdContent || '',
    skillFileBlob: blob,
  };
}

/**
 * Resolve skill content from SKILL.md source or pre-packaged .skill file
 */
export async function resolveSkillContent(skill: SkillConfig): Promise<SkillContent> {
  // Handle pre-packaged .skill files
  if (isSkillFileUrl(skill.source)) {
    return resolveSkillFile(skill);
  }

  // Handle SKILL.md files
  let response: Response;
  try {
    response = await fetch(addCacheBuster(skill.source), {
      method: 'GET',
      headers: {
        Accept: 'text/plain, text/markdown',
      },
      cache: 'no-store',
    });
  } catch (error) {
    throw new ConfigError(`Failed to fetch skill source for "${skill.name}": ${error}`);
  }

  if (!response.ok) {
    throw new ConfigError(
      `Failed to fetch skill source for "${skill.name}": ${response.status} ${response.statusText}`
    );
  }

  const content = await response.text();

  // Parse SKILL.md format
  if (isSkillMdFormat(content)) {
    const parsed = parseSkillMd(content);
    return {
      name: parsed.name || skill.name,
      description: parsed.description || skill.description,
      instructions: parsed.instructions,
    };
  }

  // Plain markdown without frontmatter - use entire content as instructions
  return {
    name: skill.name,
    description: skill.description,
    instructions: content,
  };
}

/**
 * Generate a content hash for change detection
 */
export async function hashContent(instructions: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(instructions);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
