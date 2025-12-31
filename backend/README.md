# GitHub Coverage Analyzer - Backend

A DDD/CQRS NestJS application that analyzes test coverage of TypeScript GitHub repositories and generates tests using Claude CLI.

## Architecture

This application follows **Domain-Driven Design (DDD)** principles with **CQRS** (Command Query Responsibility Segregation) and **Event-Driven Architecture**.

### Bounded Contexts

- **Job Processing**: Manages job lifecycle, orchestration, and saga workflows
- **Git Repository Analysis**: Handles repository cloning, coverage analysis, and repository management
- **Test Generation**: Manages AI-powered test generation and PR creation

### Key Patterns

- **Saga Pattern**: Orchestrates multi-step workflows across bounded contexts
- **Repository Pattern**: Abstracts data access with domain-specific interfaces
- **Event Sourcing**: Domain events drive workflow progression
- **Aggregate Roots**: Job, GitRepo, and TestGenerationRequest entities maintain consistency
- **Value Objects**: Enforce domain invariants (JobId, GitRepoUrl, FilePath)

## Prerequisites

- Node.js (v18 or higher)
- npm
- Git
- SQLite 3
- Claude CLI installed and configured
- GitHub MCP configured with user scope

## Installing and Configuring Claude CLI

This service requires Claude CLI to be properly installed and configured with the GitHub MCP server.

### 1. Install Claude CLI

Follow the [official installation guide](https://docs.claudeai.com/en/docs/claude-cli) to install Claude CLI.

### 2. Configure GitHub MCP

The service uses the GitHub MCP to create pull requests. You must configure it with `--scope user` to allow PR creation:

```bash
# Add GitHub MCP server with user scope
claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer YOUR_GITHUB_PAT" --scope user
```

For detailed setup instructions, see the [GitHub MCP Installation Guide](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-claude.md).

This configuration allows Claude to:
- Read repository information
- Create branches
- Create pull requests
- Access git status and changes

### 3. Authenticate Claude CLI

Make sure Claude CLI is authenticated with your Anthropic API key:

```bash
claude auth
```

**Important:** Without the GitHub MCP configured with `--scope user`, the PR creation feature will not work.

## Installation

```bash
npm install
```

## Database Setup

The application uses SQLite for persistence. The database will be automatically created on first run.

```bash
# Run migrations (if needed)
npm run migration:run
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` by default.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

## API Documentation

Interactive API documentation is available via Swagger UI at:

**http://localhost:3000/api**

## Key Features

### 1. Repository Lock Management
- One job per repository at a time (serialized execution)
- Automatic lock acquisition and release
- Stale lock prevention (5-minute timeout with automatic cleanup)

### 2. Job Workflows

The system supports different job workflows based on parameters:

- **Coverage Analysis Only**: Analyze repository coverage without test generation
- **Full Workflow**: Coverage + Test Generation + PR Creation
- **Child Jobs**: Reuse existing analysis to generate tests for multiple files efficiently

### 3. Event-Driven Architecture

Jobs progress through stages via domain events:
- `RepositoryClonedForJobEvent` → triggers coverage analysis
- `CoverageAnalysisCompletedForJobEvent` → triggers test generation
- `TestGenerationCompletedForJobEvent` → triggers PR creation
- `PRCreatedForJobEvent` → triggers job completion and lock release

### 4. Saga Orchestration

The Job Processing Saga coordinates the entire workflow:
- Listens to domain events
- Dispatches commands to appropriate bounded contexts
- Handles errors and ensures lock release on failures

## Project Structure

```
src/
├── bounded-contexts/
│   ├── job-processing/           # Job orchestration and lifecycle
│   │   ├── domain/
│   │   │   ├── models/           # Job entity, value objects
│   │   │   ├── repositories/     # Repository interfaces
│   │   │   └── events/           # Domain events
│   │   ├── application/
│   │   │   ├── commands/         # Command handlers
│   │   │   ├── queries/          # Query handlers
│   │   │   └── sagas/            # Saga orchestration
│   │   └── infrastructure/
│   │       └── persistence/      # TypeORM repositories
│   ├── git-repo-analysis/        # Repository and coverage analysis
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   └── test-generation/          # Test generation and PR creation
│       ├── domain/
│       ├── application/
│       └── infrastructure/
├── shared/
│   └── kernel/                   # Shared DDD building blocks
└── main.ts
```

## Security

- **Command Injection Prevention**: Uses `simple-git` library instead of shell commands
- **Path Traversal Protection**: Validates file paths against repository boundaries
- **Input Validation**: DTOs with class-validator decorators

## Concurrency & Scalability

- **Repository-level Locking**: Prevents concurrent modifications to the same repository
- **Atomic Operations**: Database-level lock acquisition with UPDATE + WHERE conditions
- **Stale Lock Cleanup**: Automatic timeout and cleanup of abandoned locks
- **Job Serialization**: Jobs for the same repository are queued and processed sequentially

## Error Handling

- Comprehensive error handling at all layers
- Failed jobs release locks automatically
- Domain events published on failures to trigger saga error handling
- Temporary directories cleaned up on errors

## Development

```bash
# Run in watch mode
npm run start:dev

# Run linter
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Notes

- Jobs are persisted in SQLite and survive server restarts
- Repository locks are database-backed for reliability
- Claude CLI executes in isolated processes for security
- The saga pattern ensures eventual consistency across bounded contexts
- Domain events are processed asynchronously via NestJS CQRS
