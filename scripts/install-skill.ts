#!/usr/bin/env tsx
/**
 * Install skills from GitHub repositories (e.g., from skills.sh)
 *
 * Usage:
 *   pnpm install-skill vercel-labs/agent-skills
 *   pnpm install-skill vercel-labs/agent-skills --skill react-best-practices
 *   pnpm install-skill vercel-labs/agent-skills -s web-design-guidelines --force --yes
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Types
// ============================================================================

interface SkillMetadata {
  name: string;
  description: string;
  version?: string;
}

interface SkillConfig {
  name: string;
  version: string;
  description: string;
  source: string;
  enabledByDefault: boolean;
  allowUserToggle: boolean;
}

interface ConfigJson {
  name: string;
  version: string;
  skills: SkillConfig[];
}

interface CliArgs {
  source: string;
  skillName?: string;
  force: boolean;
  yes: boolean;
}

// ============================================================================
// SKILL.md Parser (adapted from apps/skillforge/lib/skill-parser.ts)
// ============================================================================

function parseSkillMd(content: string): SkillMetadata {
  const trimmed = content.trim();

  if (!trimmed.startsWith('---')) {
    return { name: '', description: '' };
  }

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return { name: '', description: '' };
  }

  const frontmatter = trimmed.slice(3, endIndex).trim();
  const metadata: Record<string, string> = {};

  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      metadata[key] = value;
    }
  }

  return {
    name: metadata.name || '',
    description: metadata.description || '',
    version: metadata.version,
  };
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    source: '',
    force: false,
    yes: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--skill' || arg === '-s') {
      result.skillName = args[++i];
    } else if (arg === '--force' || arg === '-f') {
      result.force = true;
    } else if (arg === '--yes' || arg === '-y') {
      result.yes = true;
    } else if (!arg.startsWith('-')) {
      result.source = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
Usage: pnpm install-skill <github-repo> [options]

Arguments:
  <github-repo>    GitHub repository (e.g., vercel-labs/agent-skills)

Options:
  -s, --skill <name>   Install specific skill by name
  -f, --force          Overwrite existing skill without prompting
  -y, --yes            Skip all prompts (use first/specified skill)

Examples:
  pnpm install-skill vercel-labs/agent-skills
  pnpm install-skill vercel-labs/agent-skills --skill react-best-practices
  pnpm install-skill vercel-labs/agent-skills -s web-design-guidelines --force --yes
`);
}

// ============================================================================
// Git Operations
// ============================================================================

function cloneRepo(repoUrl: string, destDir: string): void {
  console.log(`Cloning ${repoUrl}...`);
  execSync(`git clone --depth 1 ${repoUrl} "${destDir}"`, {
    stdio: 'pipe',
  });
}

function getGitHubUrl(source: string): string {
  // Handle various input formats
  if (source.startsWith('https://') || source.startsWith('git@')) {
    return source;
  }
  // Assume owner/repo format
  return `https://github.com/${source}.git`;
}

// ============================================================================
// Skill Discovery
// ============================================================================

interface DiscoveredSkill {
  name: string;
  description: string;
  version: string;
  folderPath: string;
  folderName: string;
}

function discoverSkills(repoDir: string): DiscoveredSkill[] {
  const skills: DiscoveredSkill[] = [];
  const skillsDir = path.join(repoDir, 'skills');

  // Check if skills/ directory exists
  if (!fs.existsSync(skillsDir)) {
    // Try root level
    const rootSkillMd = path.join(repoDir, 'SKILL.md');
    if (fs.existsSync(rootSkillMd)) {
      const content = fs.readFileSync(rootSkillMd, 'utf-8');
      const metadata = parseSkillMd(content);
      const repoName = path.basename(repoDir);
      skills.push({
        name: metadata.name || repoName,
        description: metadata.description || '',
        version: metadata.version || '1.0.0',
        folderPath: repoDir,
        folderName: metadata.name || repoName,
      });
    }
    return skills;
  }

  // Scan skills/ directory for subdirectories with SKILL.md
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name);
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const metadata = parseSkillMd(content);

      skills.push({
        name: metadata.name || entry.name,
        description: metadata.description || '',
        version: metadata.version || '1.0.0',
        folderPath: skillPath,
        folderName: entry.name,
      });
    }
  }

  return skills;
}

// ============================================================================
// Interactive Selection
// ============================================================================

async function selectSkill(skills: DiscoveredSkill[]): Promise<DiscoveredSkill> {
  // Dynamic import of inquirer to keep it optional
  const { select } = await import('@inquirer/prompts');

  const choice = await select({
    message: 'Select a skill to install:',
    choices: skills.map((skill) => ({
      name: `${skill.name} - ${skill.description || 'No description'}`,
      value: skill.name,
    })),
  });

  return skills.find((s) => s.name === choice)!;
}

async function confirmOverwrite(skillName: string): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');

  return confirm({
    message: `Skill "${skillName}" already exists. Overwrite?`,
    default: false,
  });
}

// ============================================================================
// File Operations
// ============================================================================

function copySkillFolder(sourcePath: string, destPath: string): void {
  // Create destination directory
  fs.mkdirSync(destPath, { recursive: true });

  // Copy all files recursively
  const copyRecursive = (src: string, dest: string): void => {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPathFull = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPathFull, { recursive: true });
        copyRecursive(srcPath, destPathFull);
      } else {
        fs.copyFileSync(srcPath, destPathFull);
      }
    }
  };

  copyRecursive(sourcePath, destPath);
}

function updateConfigJson(skill: DiscoveredSkill, configPath: string): void {
  let config: ConfigJson;

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    config = {
      name: 'Skills Pack',
      version: '1.0.0',
      skills: [],
    };
  }

  // Check if skill already exists
  const existingIndex = config.skills.findIndex((s) => s.name === skill.name);

  const skillConfig: SkillConfig = {
    name: skill.name,
    version: skill.version,
    description: skill.description,
    source: `\${R2_PUBLIC_URL}/skills/${skill.name}/SKILL.md`,
    enabledByDefault: true,
    allowUserToggle: true,
  };

  if (existingIndex >= 0) {
    config.skills[existingIndex] = skillConfig;
    console.log(`Updated existing skill "${skill.name}" in config.json`);
  } else {
    config.skills.push(skillConfig);
    console.log(`Added skill "${skill.name}" to config.json`);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

function cleanupTempDir(tempDir: string): void {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (!args.source) {
    printUsage();
    process.exit(1);
  }

  const projectRoot = path.resolve(process.cwd());
  const skillsDir = path.join(projectRoot, 'skills');
  const configPath = path.join(skillsDir, 'config.json');

  // Ensure skills directory exists
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  // Create temp directory for cloning
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-install-'));

  try {
    // Clone the repository
    const repoUrl = getGitHubUrl(args.source);
    cloneRepo(repoUrl, tempDir);

    // Discover available skills
    const skills = discoverSkills(tempDir);

    if (skills.length === 0) {
      console.error('No skills found in repository. Expected SKILL.md files in skills/ subdirectories.');
      process.exit(1);
    }

    console.log(`Found ${skills.length} skill(s):`);
    skills.forEach((s) => console.log(`  - ${s.name}: ${s.description || 'No description'}`));

    // Select skill
    let selectedSkill: DiscoveredSkill;

    if (args.skillName) {
      // Find by name
      const found = skills.find(
        (s) => s.name === args.skillName || s.folderName === args.skillName
      );
      if (!found) {
        console.error(`Skill "${args.skillName}" not found in repository.`);
        console.error('Available skills:', skills.map((s) => s.name).join(', '));
        process.exit(1);
      }
      selectedSkill = found;
    } else if (skills.length === 1 || args.yes) {
      // Use first skill
      selectedSkill = skills[0];
    } else {
      // Interactive selection
      selectedSkill = await selectSkill(skills);
    }

    console.log(`\nInstalling skill: ${selectedSkill.name}`);

    // Check for existing skill
    const destPath = path.join(skillsDir, selectedSkill.name);
    if (fs.existsSync(destPath)) {
      if (args.force) {
        console.log(`Overwriting existing skill "${selectedSkill.name}"...`);
        fs.rmSync(destPath, { recursive: true, force: true });
      } else if (args.yes) {
        console.error(`Skill "${selectedSkill.name}" already exists. Use --force to overwrite.`);
        process.exit(1);
      } else {
        const shouldOverwrite = await confirmOverwrite(selectedSkill.name);
        if (!shouldOverwrite) {
          console.log('Installation cancelled.');
          process.exit(0);
        }
        fs.rmSync(destPath, { recursive: true, force: true });
      }
    }

    // Copy skill folder
    copySkillFolder(selectedSkill.folderPath, destPath);
    console.log(`Copied skill files to ${destPath}`);

    // Update config.json
    updateConfigJson(selectedSkill, configPath);

    console.log(`\nSuccessfully installed skill "${selectedSkill.name}" v${selectedSkill.version}`);
    console.log('\nNext steps:');
    console.log('  1. Review the skill at skills/' + selectedSkill.name + '/SKILL.md');
    console.log('  2. Run `pnpm upload-skills` to deploy');
  } finally {
    // Cleanup
    cleanupTempDir(tempDir);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
