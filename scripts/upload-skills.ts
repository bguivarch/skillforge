import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

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

/**
 * Get content type for file
 */
function getContentType(filename: string): string {
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.md')) return 'text/markdown';
  return 'text/plain';
}

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = readdirSync(dir);

  for (const item of items) {
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
 * Upload a file to R2
 */
async function uploadFile(localPath: string, key: string, content: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: content,
    ContentType: getContentType(localPath),
  });

  await s3Client.send(command);
  console.log(`  ✓ Uploaded: ${R2_PUBLIC_URL}/${key}`);
}

/**
 * Main upload function
 */
async function main() {
  console.log('SkillForge - Upload Skills to R2\n');
  console.log(`Bucket: ${R2_BUCKET_NAME}`);
  console.log(`Public URL: ${R2_PUBLIC_URL}\n`);

  const skillsDir = join(process.cwd(), 'skills');
  const files = getAllFiles(skillsDir);

  console.log(`Found ${files.length} files to upload:\n`);

  for (const file of files) {
    const relativePath = relative(process.cwd(), file);
    const key = relativePath; // e.g., "skills/config.json"

    let content = readFileSync(file, 'utf-8');

    // Replace placeholder in config.json
    if (file.endsWith('config.json')) {
      content = content.replace(/\$\{R2_PUBLIC_URL\}/g, R2_PUBLIC_URL!);
    }

    await uploadFile(file, key, content);
  }

  console.log('\n✓ All files uploaded successfully!');
  console.log(`\nConfig URL: ${R2_PUBLIC_URL}/skills/config.json`);
}

main().catch((error) => {
  console.error('Upload failed:', error);
  process.exit(1);
});
