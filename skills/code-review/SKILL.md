---
name: code-review
description: Review code for best practices and potential issues
---

# Code Review Assistant

When reviewing code, provide comprehensive feedback focusing on:

## Security
- Check for SQL injection vulnerabilities
- Look for XSS (Cross-Site Scripting) risks
- Identify authentication and authorization issues
- Flag hardcoded secrets or credentials

## Performance
- Identify N+1 query problems
- Look for unnecessary loops or iterations
- Check for memory leaks
- Suggest caching opportunities

## Readability
- Evaluate naming conventions (variables, functions, classes)
- Check for appropriate comments on complex logic
- Assess code organization and structure
- Identify overly complex functions that should be split

## Best Practices
- Verify proper error handling
- Check for edge case handling
- Look for code duplication
- Ensure consistent code style

## Output Format
Provide feedback in a structured format:
1. **Critical Issues** - Must fix before merging
2. **Suggestions** - Recommended improvements
3. **Positive Notes** - What was done well

Always include specific line references and suggest concrete fixes.
