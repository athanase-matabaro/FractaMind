# Contributing to FractaMind

Thank you for your interest in contributing to FractaMind! We welcome contributions from the community and are excited to build a privacy-first knowledge exploration tool together.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Git Branching Strategy](#git-branching-strategy)
3. [Code Style](#code-style)
4. [Commit Conventions](#commit-conventions)
5. [Pull Request Process](#pull-request-process)
6. [Testing Guidelines](#testing-guidelines)
7. [Reporting Issues](#reporting-issues)

---

## Development Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** package manager
- **Chrome Canary** 128+ with Chrome Built-in AI enabled (see [README.md](README.md#prerequisites))
- **Git** for version control

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork locally
git clone https://github.com/YOUR_USERNAME/fractamind.git
cd fractamind

# 3. Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/fractamind.git

# 4. Install dependencies
npm install

# 5. Start development server
npm start

# 6. Run tests to ensure everything works
npm test
```

### Project Structure

See [CLAUDE.md](CLAUDE.md#file-organization-conventions) for complete file organization conventions.

```
/src
  /components        - React UI components (e.g., ChoreComponent)
  /ai                - Chrome Built-in AI API wrappers
  /viz               - Canvas/SVG fractal renderer
  /db                - IndexedDB + fractamind-indexer
  /utils             - Morton key, embedding helpers
  /hooks             - Custom React hooks
  /constants         - Application constants
/docs                - Technical specifications and guides
/tests               - Test fixtures and integration tests
```

---

## Git Branching Strategy

**IMPORTANT**: Always create a new branch for any feature, bug fix, or refactoring. **Never commit directly to `main`**.

### Branch Naming Convention

All branches should follow this format:

```
<type>/<short-description>
```

**Branch Types**:
- `feat/` - New features (e.g., `feat/semantic-search`, `feat/node-expansion`)
- `fix/` - Bug fixes (e.g., `fix/modal-close-button`, `fix/embedding-quantization`)
- `refactor/` - Code refactoring without behavior changes (e.g., `refactor/indexer-api`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`, `docs/setup-guide`)
- `test/` - Adding or updating tests (e.g., `test/chore-component-coverage`)
- `chore/` - Maintenance tasks, dependencies (e.g., `chore/update-deps`, `chore/ci-setup`)
- `perf/` - Performance improvements (e.g., `perf/morton-key-optimization`)

### Standard Workflow

```bash
# 1. Create a new branch from main
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# 2. Make changes and commit following Conventional Commits
git add .
git commit -m "feat(search): add semantic search with Morton indexing"

# 3. Push your branch to remote
git push -u origin feat/your-feature-name

# 4. Open a Pull Request on GitHub
# 5. After review and approval, merge via GitHub (squash and merge recommended)
# 6. Delete the branch after merge

# 7. Update your local main branch
git checkout main
git pull origin main
```

### Why Branches?

- **Isolation**: Work on features without affecting `main`
- **Code Review**: PRs enable peer review before merging
- **History**: Clear commit history with meaningful merge messages
- **CI/CD**: Automated tests run on branches before merge
- **Rollback**: Easy to revert changes if needed

### Branch Lifecycle

1. **Create**: Branch off from latest `main`
2. **Develop**: Make commits following conventions
3. **Push**: Push to remote for backup and collaboration
4. **PR**: Open Pull Request with description and screenshots
5. **Review**: Address feedback, push additional commits
6. **Merge**: Squash and merge via GitHub
7. **Delete**: Remove branch after merge (both local and remote)

---

## Code Style

### General Principles

- **ES6+ JavaScript** — Use modern syntax (arrow functions, destructuring, async/await)
- **Functional components** — Prefer React function components with hooks
- **Descriptive names** — Variables and functions should be self-documenting
- **DRY principle** — Avoid duplication; extract reusable logic
- **Privacy-first** — Never add code that sends data to external servers without explicit user opt-in

### Formatting

We use **ESLint** for linting and **Prettier** for formatting:

```bash
# Check linting errors
npm run lint

# Auto-fix formatting issues
npm run lint -- --fix
```

**Key Rules**:
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings (except JSX attributes)
- **Semicolons**: Required
- **Max line length**: 100 characters
- **Trailing commas**: Required in multi-line objects/arrays

### File Naming

- **Components**: PascalCase (e.g., `ChoreComponent.jsx`)
- **Utilities**: camelCase (e.g., `computeMortonKey.js`)
- **Tests**: Match source file with `.test.js` suffix (e.g., `ChoreComponent.test.js`)
- **CSS/Styles**: camelCase (e.g., `fractalRenderer.css`)

---

## Commit Conventions

We follow **Conventional Commits** for clear, structured commit history:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature (e.g., `feat(indexer): add Hilbert curve optimization`)
- `fix`: Bug fix (e.g., `fix(search): correct cosine similarity calculation`)
- `docs`: Documentation changes (e.g., `docs(readme): update install instructions`)
- `style`: Code style/formatting (no logic changes)
- `refactor`: Code restructuring (no behavior changes)
- `test`: Add or update tests
- `chore`: Maintenance tasks (e.g., `chore: update dependencies`)
- `perf`: Performance improvements

### Examples

```bash
# Good commit messages
feat(chore-component): add modal with text input and submit callback
fix(morton-key): handle edge case for zero embeddings
docs(contributing): add PR review checklist
test(indexer): add unit tests for range scan

# Bad commit messages
update stuff
fix bug
WIP
changed files
```

### Scope

Use the component/module name (e.g., `chore-component`, `indexer`, `renderer`, `ai`).

---

## Pull Request Process

### Before Submitting

1. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Write tests** for new features or bug fixes

3. **Run the full test suite**:
   ```bash
   npm test
   npm run lint
   ```

4. **Update documentation** if you changed APIs or added features

5. **Rebase on latest main**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Submitting the PR

1. **Push your branch**:
   ```bash
   git push origin feat/your-feature-name
   ```

2. **Open a PR on GitHub** with:
   - **Clear title** following commit conventions (e.g., `feat(search): add semantic ranking`)
   - **Description** that includes:
     - Summary of changes
     - Why this change is needed
     - Screenshots (if UI changes)
     - Link to related issue (if applicable)
   - **Checklist**:
     - [ ] Tests pass locally
     - [ ] Linting passes
     - [ ] Documentation updated
     - [ ] Commit messages follow conventions
     - [ ] No merge conflicts

3. **Respond to review feedback** promptly

4. **Squash commits** if requested before merge

### PR Review Checklist (for reviewers)

- [ ] Code follows project style guidelines
- [ ] All tests pass and new tests are included
- [ ] No performance regressions
- [ ] Privacy-first principles maintained (no data leaks)
- [ ] Documentation updated
- [ ] Commit messages are clear and follow conventions

---

## Testing Guidelines

### Writing Tests

- **Unit tests**: Test individual functions/components in isolation
- **Integration tests**: Test interactions between modules (e.g., indexer + AI APIs)
- **Accessibility tests**: Ensure keyboard navigation and ARIA labels work

### Test Structure

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import ChoreComponent from './ChoreComponent';

describe('ChoreComponent', () => {
  it('renders headline and CTA button', () => {
    render(<ChoreComponent onSeedSubmit={jest.fn()} />);
    expect(screen.getByText(/paste text/i)).toBeInTheDocument();
  });

  it('opens modal when CTA is clicked', () => {
    render(<ChoreComponent onSeedSubmit={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /paste text/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onSeedSubmit when form is submitted', () => {
    const mockSubmit = jest.fn();
    render(<ChoreComponent onSeedSubmit={mockSubmit} />);
    // ... test implementation
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on file changes)
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run specific test file
npm test ChoreComponent.test.js
```

---

## Reporting Issues

### Bug Reports

When reporting bugs, include:
- **Description**: Clear summary of the issue
- **Steps to reproduce**: Numbered list of exact steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Chrome version, Node.js version
- **Screenshots**: If applicable
- **Error logs**: Console errors or stack traces

### Feature Requests

When suggesting features, include:
- **Problem statement**: What problem does this solve?
- **Proposed solution**: How would this work?
- **Alternatives considered**: Other approaches you thought about
- **Use cases**: Real-world scenarios where this helps

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or improvement
- `documentation`: Docs need updates
- `good first issue`: Beginner-friendly tasks
- `help wanted`: Community contributions welcome
- `priority: high`: Needs immediate attention

---

## Questions or Need Help?

- **Documentation**: Check [docs/](docs/) for technical specs
- **GitHub Issues**: Search existing issues or open a new one
- **Discussions**: Use GitHub Discussions for questions and ideas

Thank you for contributing to FractaMind! Your efforts help build a better privacy-first knowledge exploration tool for everyone.
