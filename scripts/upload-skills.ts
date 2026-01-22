import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import JSZip from 'jszip';

// Load environment variables
config();

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

// Validate environment
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error('Missing required environment variables. Please check your .env file.');
  console.error('Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
  process.exit(1);
}

// Create S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ============================================================================
// Types
// ============================================================================

interface SkillMetadata {
  name: string;
  description: string;
  version: string;
}

interface SkillInfo {
  dirPath: string;
  dirName: string;
  metadata: SkillMetadata;
  isComplex: boolean;
  fileCount: number;
}

interface ConfigSkill {
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
  skills: ConfigSkill[];
}

// ============================================================================
// Utilities
// ============================================================================

function getContentType(filename: string): string {
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.md')) return 'text/markdown';
  if (filename.endsWith('.skill')) return 'application/octet-stream';
  return 'text/plain';
}

/**
 * Parse SKILL.md frontmatter to get metadata
 */
function parseSkillMd(content: string): SkillMetadata {
  const trimmed = content.trim();
  const result: SkillMetadata = { name: '', description: '', version: '1.0.0' };

  if (!trimmed.startsWith('---')) return result;

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return result;

  const frontmatter = trimmed.slice(3, endIndex).trim();
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

      if (key === 'name') result.name = value;
      if (key === 'description') result.description = value;
      if (key === 'version') result.version = value;
    }
  }

  return result;
}

/**
 * Recursively get all files in a directory (excluding hidden files)
 */
function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);

  for (const item of items) {
    if (item.startsWith('.')) continue;

    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Find all skill directories and analyze them
 */
function discoverSkills(skillsDir: string): SkillInfo[] {
  const skills: SkillInfo[] = [];
  const items = readdirSync(skillsDir, { withFileTypes: true });

  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (item.name.startsWith('.')) continue;

    const dirPath = join(skillsDir, item.name);
    const skillMdPath = join(dirPath, 'SKILL.md');

    if (!existsSync(skillMdPath)) continue;

    const skillMdContent = readFileSync(skillMdPath, 'utf-8');
    const metadata = parseSkillMd(skillMdContent);
    const files = getAllFiles(dirPath);

    // A skill is "complex" if it has more than just SKILL.md
    const isComplex = files.length > 1;

    skills.push({
      dirPath,
      dirName: item.name,
      metadata: {
        name: metadata.name || item.name,
        description: metadata.description,
        version: metadata.version,
      },
      isComplex,
      fileCount: files.length,
    });
  }

  return skills;
}

/**
 * Build a .skill ZIP file from a skill directory
 */
async function buildSkillFile(skill: SkillInfo): Promise<Buffer> {
  const zip = new JSZip();
  const files = getAllFiles(skill.dirPath);

  // IMPORTANT: Use createFolders: false to avoid explicit directory entries
  // Claude's parser expects files only, no directory entries
  for (const file of files) {
    const relativePath = relative(skill.dirPath, file);
    const zipPath = `${skill.metadata.name}/${relativePath}`;
    const content = readFileSync(file);
    zip.file(zipPath, content, { createFolders: false });
  }

  // Use platform: 'UNIX' to match Claude's expected format
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
}

/**
 * Upload content to R2
 */
async function uploadToR2(key: string, content: string | Buffer, contentType: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: content,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

/**
 * List all objects in R2 with a given prefix
 */
async function listR2Objects(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

/**
 * Delete an object from R2
 */
async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Extract skill names from remote R2 keys
 * Handles both simple skills (skills/name/SKILL.md) and complex skills (skills/name.skill)
 */
function extractRemoteSkillNames(keys: string[]): Set<string> {
  const names = new Set<string>();

  for (const key of keys) {
    // Skip config.json
    if (key === 'skills/config.json') continue;

    // Complex skill: skills/name.skill
    const skillMatch = key.match(/^skills\/([^/]+)\.skill$/);
    if (skillMatch) {
      names.add(skillMatch[1]);
      continue;
    }

    // Simple skill: skills/name/SKILL.md or skills/name/anything
    const dirMatch = key.match(/^skills\/([^/]+)\//);
    if (dirMatch) {
      names.add(dirMatch[1]);
    }
  }

  return names;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('SkillForge - Upload Skills to R2\n');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Public URL: ${R2_PUBLIC_URL}\n`);

  const skillsDir = join(process.cwd(), 'skills');
  const configPath = join(skillsDir, 'config.json');

  // Discover all skills
  const skills = discoverSkills(skillsDir);

  if (skills.length === 0) {
    console.log('No skills found in skills/ directory.');
    console.log('Each skill should be in a subdirectory containing a SKILL.md file.');
    process.exit(0);
  }

  console.log(`Found ${skills.length} skill(s):\n`);

  // Load existing config or create new one
  let configJson: ConfigJson;
  if (existsSync(configPath)) {
    configJson = JSON.parse(readFileSync(configPath, 'utf-8'));
  } else {
    configJson = {
      name: 'Skills Pack',
      version: '1.0.0',
      skills: [],
    };
  }

  // Process each skill
  const uploadedSkills: { name: string; source: string; isComplex: boolean }[] = [];

  for (const skill of skills) {
    const typeLabel = skill.isComplex ? 'complex' : 'simple';
    console.log(`\n📦 ${skill.metadata.name} (${typeLabel}, ${skill.fileCount} file${skill.fileCount > 1 ? 's' : ''})`);

    if (skill.isComplex) {
      // Complex skill: build and upload .skill file
      console.log('   Building .skill package...');
      const buffer = await buildSkillFile(skill);
      const key = `skills/${skill.metadata.name}.skill`;

      await uploadToR2(key, buffer, 'application/octet-stream');
      console.log(`   ✓ Uploaded: ${R2_PUBLIC_URL}/${key} (${(buffer.length / 1024).toFixed(2)} KB)`);

      uploadedSkills.push({
        name: skill.metadata.name,
        source: `${R2_PUBLIC_URL}/skills/${skill.metadata.name}.skill`,
        isComplex: true,
      });

      // Also upload individual files for browsing/debugging
      const files = getAllFiles(skill.dirPath);
      for (const file of files) {
        const relativePath = relative(process.cwd(), file);
        const content = readFileSync(file, 'utf-8');
        await uploadToR2(relativePath, content, getContentType(file));
        console.log(`   ✓ Uploaded: ${R2_PUBLIC_URL}/${relativePath}`);
      }
    } else {
      // Simple skill: just upload SKILL.md
      const skillMdPath = join(skill.dirPath, 'SKILL.md');
      const content = readFileSync(skillMdPath, 'utf-8');
      const key = `skills/${skill.dirName}/SKILL.md`;

      await uploadToR2(key, content, 'text/markdown');
      console.log(`   ✓ Uploaded: ${R2_PUBLIC_URL}/${key}`);

      uploadedSkills.push({
        name: skill.metadata.name,
        source: `${R2_PUBLIC_URL}/skills/${skill.dirName}/SKILL.md`,
        isComplex: false,
      });
    }

    // Update config entry
    const existingIndex = configJson.skills.findIndex(s => s.name === skill.metadata.name);
    const skillConfig: ConfigSkill = {
      name: skill.metadata.name,
      version: skill.metadata.version,
      description: skill.metadata.description,
      source: skill.isComplex
        ? `\${R2_PUBLIC_URL}/skills/${skill.metadata.name}.skill`
        : `\${R2_PUBLIC_URL}/skills/${skill.dirName}/SKILL.md`,
      enabledByDefault: existingIndex >= 0 ? configJson.skills[existingIndex].enabledByDefault : true,
      allowUserToggle: existingIndex >= 0 ? configJson.skills[existingIndex].allowUserToggle : true,
    };

    if (existingIndex >= 0) {
      configJson.skills[existingIndex] = skillConfig;
    } else {
      configJson.skills.push(skillConfig);
    }
  }

  // Detect and delete removed skills
  console.log('\n🔍 Checking for deleted skills...');

  const remoteKeys = await listR2Objects('skills/');
  const remoteSkillNames = extractRemoteSkillNames(remoteKeys);

  // Build set of local skill identifiers (both name and dirName to handle renames)
  const localSkillIdentifiers = new Set<string>();
  for (const skill of skills) {
    localSkillIdentifiers.add(skill.metadata.name);
    localSkillIdentifiers.add(skill.dirName);
  }

  // Find skills to delete
  const skillsToDelete: string[] = Array.from(remoteSkillNames).filter(
    remoteName => !localSkillIdentifiers.has(remoteName)
  );

  if (skillsToDelete.length > 0) {
    console.log(`Found ${skillsToDelete.length} skill(s) to delete:\n`);

    for (const skillName of skillsToDelete) {
      console.log(`🗑️  Deleting: ${skillName}`);

      // Find all keys related to this skill
      const keysToDelete = remoteKeys.filter(key => {
        // Match skills/name.skill
        if (key === `skills/${skillName}.skill`) return true;
        // Match skills/name/... (directory contents)
        if (key.startsWith(`skills/${skillName}/`)) return true;
        return false;
      });

      for (const key of keysToDelete) {
        await deleteFromR2(key);
        console.log(`   ✓ Deleted: ${key}`);
      }

      // Remove from config
      configJson.skills = configJson.skills.filter(s => s.name !== skillName);
    }
  } else {
    console.log('No deleted skills found.');
  }

  // Save updated config.json locally
  writeFileSync(configPath, JSON.stringify(configJson, null, 2) + '\n');
  console.log(`\n✓ Updated local config.json`);

  // Upload config.json with resolved URLs
  const configContent = JSON.stringify(configJson, null, 2).replace(/\$\{R2_PUBLIC_URL\}/g, R2_PUBLIC_URL!);
  await uploadToR2('skills/config.json', configContent, 'application/json');
  console.log(`✓ Uploaded: ${R2_PUBLIC_URL}/skills/config.json`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Upload Complete!\n');
  console.log(`Config URL: ${R2_PUBLIC_URL}/skills/config.json\n`);

  console.log('Skills:');
  for (const skill of uploadedSkills) {
    const label = skill.isComplex ? '[complex]' : '[simple]';
    console.log(`  ${label} ${skill.name}`);
    console.log(`          ${skill.source}`);
  }
}

main().catch((error) => {
  console.error('Upload failed:', error);
  process.exit(1);
});
