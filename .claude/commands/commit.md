# Smart Commit

Analyze Git changes and generate a conventional commit message following the Commitizen format.

## Arguments

- `$ARGUMENTS` - Optional: Additional context or instructions for the commit message

## Instructions

Generate a conventional commit message by analyzing the current Git changes.

### Step 1: Gather Git Information

Run these commands in parallel:

1. `git status` - See staged and unstaged changes
2. `git diff --cached` - See staged changes (what will be committed)
3. `git diff` - See unstaged changes
4. `git log --oneline -5` - See recent commit style for consistency

### Step 2: Analyze the Changes

Based on the diff, determine:

1. **Type** - Choose the most appropriate type:
   - `feat` — A new feature
   - `fix` — A bug fix
   - `docs` — Documentation only changes
   - `style` — Formatting, white-space, missing semi-colons (no code change)
   - `refactor` — Code change that neither fixes a bug nor adds a feature
   - `perf` — Performance improvement
   - `test` — Adding or correcting tests
   - `build` — Changes to build system or dependencies
   - `ci` — Changes to CI configuration
   - `chore` — Other changes (tooling, config, etc.)
   - `revert` — Reverts a previous commit

2. **Scope** — The area of the codebase affected (optional but recommended):
   - Use lowercase, kebab-case
   - Examples: `task`, `auth`, `api`, `db`, `channel`, `note`
   - Derive from folder structure or feature name

3. **Description** — A short, imperative summary:
   - Use imperative mood ("add" not "added" or "adds")
   - Don't capitalize first letter
   - No period at the end
   - Max 50 characters

4. **Breaking Change** — If this introduces breaking changes:
   - Add an exclamation mark after the scope: `feat(api)!: remove deprecated endpoint`
   - Or add a footer: `BREAKING CHANGE: explanation here`

### Step 3: Format the Commit Message

Follow the Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Examples:**
- `feat(task): add resolve button`
- `fix(auth): resolve session expiry on mobile`
- `refactor(api): extract validation logic to shared utils`
- `chore(deps): upgrade tanstack query to v5.62`
- `docs(readme): update deployment instructions`

### Step 4: Stage Changes (if needed)

If there are unstaged changes that should be included:
- Ask the user if they want to stage all changes or specific files
- Use `git add` to stage the requested files

### Step 5: Present the Commit Message

Show the proposed commit message and ask for confirmation:

```
Proposed commit message:

  feat(task): add resolve button

  - Add resolve button on task header
  - Handle logic for resolving tasks

Files to be committed:
  - apps/web/src/features/task/...

Proceed with this commit? (or provide feedback to adjust)
```

### Step 6: Create the Commit

Once approved, create the commit:

**IMPORTANT:** Do NOT add any attribution footer (like "Generated with Claude Code" or "Co-Authored-By"). Use only the commit message format specified above.

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body if applicable>
EOF
)"
```

### Step 7: Confirm Success

Run `git log -1` to show the created commit.

---

## Rules

1. **Never commit without user approval** of the message
2. **Never use `--amend`** unless explicitly requested
3. **Never use `--no-verify`** to skip hooks
4. **Always use imperative mood** in descriptions
5. **Keep descriptions under 50 characters**
6. **Use body** for complex changes that need explanation
7. **Match the repository's existing commit style** when possible
8. **Never add attribution footers** - Do not include "Generated with Claude Code" or "Co-Authored-By" lines
