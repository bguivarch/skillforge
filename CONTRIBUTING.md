# Contributing to SkillForge

Thank you for your interest in contributing to SkillForge! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)
- [Skill Contributions](#skill-contributions)
- [Style Guidelines](#style-guidelines)

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). Please read and follow it in all your interactions with the project.

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- pnpm >= 10.0.0
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/skillforge.git
   cd skillforge
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Create a branch for your contribution:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Environment Setup

Copy the example environment files:

```bash
cp .env.example .env
cp apps/skillforge/.env.example apps/skillforge/.env
```

Fill in your environment variables (see README.md for details).

## Development Workflow

### Running the Extension

```bash
# Development mode with hot reload
pnpm dev

# Type checking
pnpm typecheck

# Build for production
pnpm build

# Create ZIP for Chrome Web Store
pnpm zip
```

### Working with Skills

```bash
# Upload skills to R2
pnpm upload-skills

# Install skills from a repository
pnpm install-skill vercel-labs/agent-skills
```

## Submitting Changes

### Pull Request Process

1. **Fork and Branch**: Create a feature branch from `main`
2. **Make Changes**: Implement your changes following our style guidelines
3. **Test**: Ensure your changes work correctly
4. **Commit**: Write clear, descriptive commit messages
5. **Push**: Push to your fork
6. **PR**: Open a pull request with a clear description

### Commit Message Format

Use conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(extension): add skill toggle functionality
fix(upload): handle R2 authentication errors
docs(readme): update installation instructions
```

### Pull Request Template

When opening a PR, include:

- **Description**: What changes you made and why
- **Testing**: How you tested your changes
- **Screenshots**: If applicable (UI changes)
- **Breaking Changes**: Any breaking changes (if applicable)

## Reporting Issues

### Bug Reports

When reporting bugs, include:

- **Environment**: OS, browser version, Node.js version
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Screenshots**: If applicable

### Feature Requests

When requesting features, include:

- **Use Case**: Why this feature would be useful
- **Proposed Solution**: How you envision the feature working
- **Alternatives**: Any alternative solutions you've considered

## Skill Contributions

We welcome contributions to our skill library! Skills are the core of SkillForge.

### Creating a New Skill

1. **Use the Skill Creator** (recommended):
   ```bash
   python3 .claude/skills/skill-creator/scripts/init_skill.py your-skill-name
   ```

2. **Or Create Manually**:
   - Create `skills/your-skill-name/SKILL.md`
   - Add entry to `skills/config.json`
   - Follow the [skill format guidelines](README.md#skillmd-format)

### Skill Guidelines

- **Quality**: Skills should be well-tested and provide clear value
- **Documentation**: Include clear instructions and examples
- **Naming**: Use lowercase, hyphenated names
- **Versioning**: Follow semantic versioning
- **Compatibility**: Ensure skills work with the latest Claude.ai

### Submitting Skills

1. Fork the repository
2. Add your skill to the `skills/` directory
3. Update `skills/config.json`
4. Test the skill locally
5. Submit a pull request with "skill:" prefix in the title

## Style Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Svelte**: Follow Svelte best practices
- **Formatting**: Use Prettier (configured in the project)
- **Linting**: Use ESLint (configured in the project)

### File Organization

- **Components**: Place Svelte components in `apps/skillforge/components/`
- **Utilities**: Place shared code in `apps/skillforge/lib/`
- **Scripts**: Place CLI scripts in `scripts/`
- **Skills**: Place skills in `skills/`

### Naming Conventions

- **Files**: kebab-case (`skill-manager.svelte`)
- **Components**: PascalCase (`SkillManager.svelte`)
- **Functions**: camelCase (`handleSkillSync`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

## Testing

### Extension Testing

- Test the extension in Chrome's developer mode
- Verify all UI components work correctly
- Test skill synchronization functionality
- Check error handling

### Skill Testing

- Test skills with various inputs
- Verify skill instructions are clear
- Test skill installation and updates
- Check compatibility with Claude.ai

## Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For general questions and ideas
- **Documentation**: Check the [README](README.md) for setup and usage

## License

By contributing to SkillForge, you agree that your contributions will be licensed under the same license as the project (Apache 2.0).

---

Thank you for contributing to SkillForge! Your contributions help make team AI skill management better for everyone.
