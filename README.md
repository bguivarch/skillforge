# SkillForge

A Chrome extension and CLI toolkit for managing team-shared Claude.ai skills. Centralize your organization's AI instructions, sync them across team members, and keep everyone on the same version.

## Why SkillForge?

Claude.ai skills are powerful but managing them across a team is challenging:

- **No native team sharing** - Skills are personal, requiring manual copy-paste
- **Version drift** - Team members end up with different versions of the same skill
- **Onboarding friction** - New hires need to manually set up all team skills
- **No audit trail** - Hard to track what skills exist and who has what

SkillForge solves this by:

1. **Centralizing skills** in a Git repository with version control
2. **Hosting them** on Cloudflare R2 (or any S3-compatible storage)
3. **Syncing automatically** via a Chrome extension to team members' Claude.ai accounts

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   skills/       │     │   Cloudflare    │     │   Chrome        │
│   ├── config    │────▶│   R2 Bucket     │────▶│   Extension     │
│   └── *.md      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
   pnpm upload-skills                           Syncs to Claude.ai
```

1. Define skills as Markdown files with YAML frontmatter
2. Upload to R2 with `pnpm upload-skills`
3. Team installs the Chrome extension
4. Extension syncs skills to their Claude.ai accounts

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/bguivarch/skillforge.git
cd skillforge
pnpm install
```

### 2. Configure Environment

See [Setting Up Cloudflare R2](#setting-up-cloudflare-r2) for how to get these credentials.

Create a `.env` file in the root:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=skillforge-skills
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

Create `apps/skillforge/.env`:

```bash
VITE_CONFIG_URL=https://pub-xxxx.r2.dev/skills/config.json
```

### 3. Add Your First Skill

Browse available skills at [skills.sh](https://skills.sh/) and install one:

```bash
# See available skills from a repository
pnpm install-skill vercel-labs/agent-skills

# Or install a specific skill directly
pnpm install-skill vercel-labs/agent-skills --skill react-best-practices
```

This automatically:
- Downloads the skill to `skills/<skill-name>/`
- Updates `skills/config.json` with the new entry

### 4. Upload Skills

```bash
pnpm upload-skills
```

### 5. Build and Install Extension

```bash
pnpm build
```

Then load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist/chrome-mv3`

## CLI Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start extension in development mode with hot reload |
| `pnpm build` | Build extension for production |
| `pnpm zip` | Create ZIP file for Chrome Web Store |
| `pnpm upload-skills` | Upload skills folder to R2 |
| `pnpm install-skill <repo>` | Install skills from GitHub |
| `pnpm typecheck` | Type-check TypeScript |

### Installing Skills from GitHub

Import skills from the [skills.sh](https://skills.sh/) directory or any GitHub repository:

```bash
# Interactive selection
pnpm install-skill vercel-labs/agent-skills

# Install specific skill
pnpm install-skill vercel-labs/agent-skills --skill react-best-practices

# Non-interactive (for CI)
pnpm install-skill vercel-labs/agent-skills -s web-design-guidelines --force --yes
```

**Options:**
- `-s, --skill <name>` - Install specific skill by name
- `-f, --force` - Overwrite existing skill without prompting
- `-y, --yes` - Skip all prompts

## Skill Configuration

### config.json Structure

```json
{
  "name": "Team Name Skills Pack",
  "version": "1.0.0",
  "skills": [
    {
      "name": "skill-name",
      "version": "1.0.0",
      "description": "What this skill does",
      "source": "${R2_PUBLIC_URL}/skills/skill-name/SKILL.md",
      "enabledByDefault": true,
      "allowUserToggle": true
    }
  ]
}
```

### Skill Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphenated) |
| `version` | Yes | Semantic version for change tracking |
| `description` | Yes | Brief description shown in UI |
| `source` | Yes | URL to SKILL.md file |
| `enabledByDefault` | No | Auto-enable on first sync (default: true) |
| `allowUserToggle` | No | Let users enable/disable (default: true) |

### SKILL.md Format

```markdown
---
name: skill-name
description: Brief description
---

# Skill Title

Main instructions go here. This is what Claude receives.

## Section 1
Content...

## Section 2
Content...
```

The YAML frontmatter contains metadata, and everything after becomes the skill instructions.

### Creating Custom Skills

Use the skill-creator to scaffold a new skill with the proper structure:

```bash
python3 .claude/skills/skill-creator/scripts/init_skill.py my-custom-skill
```

This automatically:
- Creates `skills/my-custom-skill/` with a SKILL.md template
- Adds example `scripts/`, `references/`, and `assets/` directories
- Updates `skills/config.json` with the new skill entry

Then edit `skills/my-custom-skill/SKILL.md` to add your instructions and update the description in `skills/config.json`.

### Creating Custom Skills (Manual)

If you prefer to create skills manually:

1. Create a folder in `skills/` with your skill name:

```bash
mkdir skills/my-custom-skill
```

2. Create `skills/my-custom-skill/SKILL.md`:

```markdown
---
name: my-custom-skill
description: What this skill does
---

# My Custom Skill

Instructions for Claude go here...
```

3. Add the entry to `skills/config.json`:

```json
{
  "name": "my-custom-skill",
  "version": "1.0.0",
  "description": "What this skill does",
  "source": "${R2_PUBLIC_URL}/skills/my-custom-skill/SKILL.md",
  "enabledByDefault": true,
  "allowUserToggle": true
}
```

4. Upload and sync:

```bash
pnpm upload-skills
```

## Environment Variables

### Root `.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 API access key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API secret access key |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | Public URL for the R2 bucket |

### Extension `.env` (`apps/skillforge/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONFIG_URL` | Yes | URL to your hosted config.json |

## Project Structure

```
skillforge/
├── apps/
│   └── skillforge/          # Chrome extension (WXT + Svelte)
│       ├── entrypoints/
│       │   ├── background/  # Service worker
│       │   └── popup/       # Extension popup UI
│       ├── components/      # Svelte components
│       ├── lib/             # Shared utilities
│       └── public/          # Extension icons
├── scripts/
│   ├── upload-skills.ts     # Upload to R2
│   └── install-skill.ts     # Install from GitHub
├── skills/
│   ├── config.json          # Skill definitions
│   └── */SKILL.md           # Individual skills
└── package.json
```

## Extension Features

### Skill States

| State | Badge | Description |
|-------|-------|-------------|
| Managed | `[checkmark]` | In config, installed, version matches |
| Outdated | `[arrow up] Update` | In config, version changed |
| Orphaned | `[warning] Removed` | Was managed, removed from config |
| Other | - | User's personal skill (not managed) |

### User Actions

- **Sync All** - Install/update all skills from config
- **Update Individual** - Update a single outdated skill
- **Toggle** - Enable/disable skills (if allowed)
- **View Status** - See skill states and last sync time

### Extension Badge

Shows count of pending actions (new skills + available updates).

## Setting Up Cloudflare R2

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) (create an account if needed)
2. Navigate to R2 Object Storage
3. Create a new bucket
4. Enable public access (or use a custom domain)
5. Create an API token with R2 read/write permissions
6. Copy credentials to your `.env` file

## Development

### Running Locally

```bash
# Start extension dev server
pnpm dev

# This opens Chrome with the extension loaded
# Changes hot-reload automatically
```

### Tech Stack

- **Extension Framework**: [WXT](https://wxt.dev/) (Web Extension Toolkit)
- **UI**: Svelte 5
- **Language**: TypeScript
- **Storage**: WXT Storage API
- **Build**: Vite

### Architecture

```
Popup UI (Svelte)
    │
    ▼
lib/messaging.ts ──────▶ background/index.ts
                              │
                              ▼
                        sync-engine.ts
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            config-loader.ts      api-client.ts
                    │                   │
                    ▼                   ▼
               R2 Bucket          Claude.ai API
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## Related Projects

- [skills.sh](https://skills.sh/) - The Agent Skills Directory
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) - Community skills
- [vercel-labs/add-skill](https://github.com/vercel-labs/add-skill) - Official CLI
