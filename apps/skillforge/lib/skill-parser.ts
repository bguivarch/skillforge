import type { SkillContent } from './types';

/**
 * Error thrown when parsing SKILL.md fails
 */
export class SkillParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillParseError';
  }
}

/**
 * Parse a SKILL.md file with YAML frontmatter + markdown body
 *
 * Format:
 * ```
 * ---
 * name: skill-name
 * description: Brief description
 * ---
 *
 * # Markdown content here
 * This becomes the instructions field.
 * ```
 */
export function parseSkillMd(content: string): SkillContent {
  const trimmed = content.trim();

  // Check for frontmatter
  if (!trimmed.startsWith('---')) {
    // No frontmatter - treat entire content as instructions
    return {
      name: '',
      description: '',
      instructions: trimmed,
    };
  }

  // Find the closing frontmatter delimiter
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    throw new SkillParseError('Invalid SKILL.md: missing closing frontmatter delimiter');
  }

  // Extract frontmatter and body
  const frontmatter = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  // Parse YAML-like frontmatter (simple key: value parsing)
  const metadata: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      metadata[key] = value;
    }
  }

  return {
    name: metadata.name || '',
    description: metadata.description || '',
    instructions: body,
  };
}

/**
 * Check if content looks like a SKILL.md file
 */
export function isSkillMdFormat(content: string): boolean {
  return content.trim().startsWith('---');
}
