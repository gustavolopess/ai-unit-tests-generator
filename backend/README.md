# GitHub Coverage Analyzer

A NestJS application that analyzes test coverage of TypeScript GitHub repositories using Claude CLI.

## Overview

This service:
1. Clones a given GitHub repository into a temporary folder
2. Uses Claude CLI to analyze the repository's test infrastructure
3. Determines test coverage for each file
4. Returns coverage data in JSON format

## Prerequisites

- Node.js (v16 or higher)
- npm
- Git
- Claude CLI installed and configured
- GitHub MCP configured with user scope

### Installing and Configuring Claude CLI

This service requires Claude CLI to be properly installed and configured with the GitHub MCP server.

#### 1. Install Claude CLI

Follow the [official installation guide](https://github.com/instantlyeasy/claude-code) to install Claude CLI.

#### 2. Configure GitHub MCP

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

#### 3. Authenticate Claude CLI

Make sure Claude CLI is authenticated with your Anthropic API key:

```bash
claude auth
```

**Important:** Without the GitHub MCP configured with `--scope user`, the PR creation feature will not work.

## Installation

```bash
npm install
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

## API Documentation

Interactive API documentation is available via Swagger UI at:

**http://localhost:3000/api**

The Swagger interface provides:
- Complete API reference with all endpoints
- Request/response schemas
- Interactive "Try it out" functionality to test endpoints directly
- Example request bodies and responses
- Detailed parameter descriptions

## API Endpoints

The service uses a unified job-based asynchronous architecture. All jobs are created via a single endpoint: `POST /jobs` and retrieved via `GET /jobs/:jobId`.

The system automatically determines which stages to execute based on the parameters you provide:
- **Coverage Analysis Only**: Provide just `repositoryUrl`
- **Coverage + Test Generation**: Provide `repositoryUrl` + `targetFilePath`
- **Coverage + Test Generation + PR Creation**: Provide `repositoryUrl` + `targetFilePath` (PR creation runs automatically)
- **Child Job (Reuse Analysis)**: Provide `jobId` + `targetFilePath` to skip cloning and analysis stages

### Job Creation: POST /jobs

Creates and starts a new job. The system automatically determines which stages to execute based on the parameters provided.

#### Scenario 1: Coverage Analysis Only

Analyze test coverage for a repository without generating tests or creating PRs.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/username/repository.git"
}
```

**What Happens:**
1. ✅ Clone repository
2. ✅ Install dependencies (`npm install`)
3. ✅ Analyze test coverage
4. ❌ Skip test generation
5. ❌ Skip PR creation

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created for coverage analysis"
}
```

---

#### Scenario 2: Coverage Analysis with Monorepo Entrypoint

For repositories where the source code is in a subdirectory (e.g., monorepos).

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/org/monorepo.git",
  "entrypoint": "packages/backend"
}
```

**What Happens:**
1. ✅ Clone repository
2. ✅ Change directory to `packages/backend`
3. ✅ Install dependencies in `packages/backend`
4. ✅ Analyze coverage in `packages/backend`
5. ❌ Skip test generation
6. ❌ Skip PR creation

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440001",
  "repositoryUrl": "https://github.com/org/monorepo.git",
  "status": "PENDING",
  "message": "Job created for coverage analysis"
}
```

---

#### Scenario 3: Full Workflow (Coverage + Test Generation + PR Creation)

Generate tests for a specific file and automatically create a pull request.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/username/repository.git",
  "targetFilePath": "src/services/user.service.ts"
}
```

**What Happens:**
1. ✅ Clone repository
2. ✅ Install dependencies
3. ✅ Analyze test coverage
4. ✅ Generate tests for `src/services/user.service.ts`
5. ✅ Create pull request with generated tests

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440002",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created for test generation and PR creation"
}
```

---

#### Scenario 4: Child Job (Reuse Previous Analysis)

Generate tests for another file using an existing job's repository and analysis results. This skips cloning, installation, and coverage analysis stages.

**Use Case:** You already ran a coverage analysis job (`job-abc-123`) and want to generate tests for multiple files without re-analyzing the entire repository each time.

**Request Body:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "targetFilePath": "src/services/auth.service.ts"
}
```

**What Happens:**
1. ❌ Skip cloning (reuse existing repository)
2. ❌ Skip installation (dependencies already installed)
3. ❌ Skip coverage analysis (reuse existing results)
4. ✅ Generate tests for `src/services/auth.service.ts`
5. ✅ Create pull request with generated tests

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440003",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Created child job 550e8400-e29b-41d4-a716-446655440003 for test generation (reusing analysis from 550e8400-e29b-41d4-a716-446655440000)"
}
```

**Benefits of Child Jobs:**
- ⚡ Much faster (skips clone, install, and analysis)
- 💰 Lower cost (reuses existing Claude analysis)
- 🔄 Efficient for generating tests for multiple files

---

### Job Status: GET /jobs/:jobId

Gets job status and results. Poll this endpoint to monitor progress.

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "parentJobId": null,
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "COMPLETED",
  "totalFiles": 15,
  "averageCoverage": 67.5,
  "files": [
    {"file": "src/index.ts", "coverage": 85.5},
    {"file": "src/utils.ts", "coverage": 42.0}
  ],
  "testGenerationResult": null,
  "prCreationResult": null,
  "error": null,
  "output": [
    "Cloning repository...",
    "Repository cloned",
    "Installing dependencies...",
    "Dependencies installed",
    "Analyzing coverage...",
    "Analysis completed"
  ]
}
```

**Job Statuses:**
- `PENDING`: Job created, not yet started
- `CLONING`: Cloning repository from GitHub
- `INSTALLING`: Running `npm install`
- `ANALYZING`: Analyzing test coverage
- `GENERATING_TESTS`: Generating unit tests for target file
- `CREATING_PR`: Creating GitHub pull request
- `COMPLETED`: All stages completed successfully
- `TEST_GENERATION_COMPLETED`: Test generation completed (with or without PR)
- `PR_CREATED`: Pull request created successfully
- `FAILED`: Job failed at any stage

## How It Works

The service uses a unified asynchronous job-based architecture:

1. **Job Creation**: POST to `/jobs` creates a job and returns immediately with a job ID. The job starts processing in the background.

2. **Stage Determination**: The system automatically determines which stages to execute based on the parameters:
   - `repositoryUrl` only → Coverage analysis
   - `repositoryUrl` + `targetFilePath` → Coverage + Test generation + PR creation
   - `jobId` + `targetFilePath` → Skip to test generation (reuse existing analysis)

3. **Repository Stage** (if not a child job):
   - Clone the GitHub repository
   - Change to entrypoint directory (if specified)
   - Run `npm install`

4. **Coverage Analysis Stage** (if not a child job):
   - Execute Claude CLI to analyze test coverage
   - Store results in both the job and the repository

5. **Test Generation Stage** (if `targetFilePath` provided):
   - Generate unit tests for the specified file using Claude CLI
   - Capture Claude session ID for PR creation

6. **PR Creation Stage** (if `targetFilePath` provided):
   - Create a GitHub pull request with generated tests
   - Reuse Claude session for context continuity

7. **Job Completion**: Results are stored and can be retrieved via `GET /jobs/:jobId`.

## Example Usage

### Example 1: Simple Coverage Analysis

Analyze a repository to get coverage metrics:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/username/repository.git"}'
```

Response:
```json
{
  "jobId": "abc-123",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created for coverage analysis"
}
```

Check the result:
```bash
curl http://localhost:3000/jobs/abc-123
```

---

### Example 2: Full Workflow (Analysis + Tests + PR)

Generate tests for a specific file and create a PR in one job:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/username/repository.git",
    "targetFilePath": "src/services/user.service.ts"
  }'
```

Response:
```json
{
  "jobId": "def-456",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created for test generation and PR creation"
}
```

Monitor progress:
```bash
curl http://localhost:3000/jobs/def-456
```

The job will automatically:
1. Clone the repository
2. Analyze coverage
3. Generate tests for `src/services/user.service.ts`
4. Create a pull request with the changes

---

### Example 3: Generate Tests for Multiple Files Efficiently

First, run a coverage analysis:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/username/repository.git"}'
```

Response: `{"jobId": "analysis-job-123", ...}`

Wait for it to complete, then create child jobs for each file you want to test:

```bash
# Generate tests for first file
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "analysis-job-123",
    "targetFilePath": "src/services/user.service.ts"
  }'

# Generate tests for second file (reuses same analysis)
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "analysis-job-123",
    "targetFilePath": "src/services/auth.service.ts"
  }'

# Generate tests for third file (reuses same analysis)
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "analysis-job-123",
    "targetFilePath": "src/utils/helpers.ts"
  }'
```

Each child job:
- ✅ Skips cloning (saves time)
- ✅ Skips installation (saves time)
- ✅ Skips coverage analysis (saves time and money)
- ✅ Only generates tests and creates PR

---

### Example 4: Monorepo with Entrypoint

For a monorepo where code is in a subdirectory:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/org/monorepo.git",
    "entrypoint": "packages/backend"
  }'
```

This will:
- Clone the repository
- Change to `packages/backend` directory
- Run `npm install` in `packages/backend`
- Analyze coverage in `packages/backend`

## Project Structure

```
src/
├── claude/
│   ├── claude.module.ts      # Claude CLI integration module
│   └── claude.service.ts     # Service for executing Claude CLI
├── coverage/
│   ├── coverage.controller.ts # REST API controller
│   ├── coverage.module.ts     # Coverage module
│   ├── coverage.service.ts    # Async job processing service
│   └── dto/
│       ├── analyze-repository.dto.ts  # Request DTO
│       ├── coverage-response.dto.ts   # Response DTOs
│       └── job-response.dto.ts        # Job-related DTOs
├── git/
│   ├── git.module.ts         # Git operations module
│   └── git.service.ts        # Service for cloning and cleanup
├── job/
│   ├── job.entity.ts         # Job entity and status enum
│   ├── job.module.ts         # Job module
│   └── job.service.ts        # In-memory job storage and lifecycle
├── app.module.ts             # Root application module
└── main.ts                   # Application entry point
```

## Configuration

The application uses the following default configurations:

- Port: 3000 (configurable via `PORT` environment variable)
- Claude CLI timeout: 30 minutes (for long-running analyses)
- Max buffer size: 50MB
- Job storage: In-memory (jobs are lost on server restart)

## Error Handling

The service includes comprehensive error handling:

- Invalid repository URLs are rejected with validation errors
- Failed git clones return appropriate error messages
- Claude CLI execution failures are caught and logged
- Temporary directories are always cleaned up, even on errors

## Development

```bash
# Run in watch mode
npm run start:dev

# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint
npm run lint

# Format
npm run format
```

## Notes

- The Claude CLI must be properly authenticated before using this service
- Large repositories may take several minutes to analyze (up to 30 minutes)
- Jobs are processed asynchronously - poll the status endpoint to check progress
- **Real-time output**: The `output` field in job status/result shows live logs from Claude CLI, so you can see what's happening during analysis
- **Screen sessions**: Claude runs in a `screen` session for easy debugging
  - Check the job status/output for the screen session name (e.g., `claude-1234567890`)
  - Attach to the session: `screen -r claude-1234567890`
  - View the log file: `tail -f /tmp/claude-1234567890.log`
  - Detach from screen: Press `Ctrl+A` then `D`
- Job data is stored in-memory and will be lost if the server restarts
- The service automatically handles cleanup of temporary directories and screen sessions
- Coverage percentages are rounded to 2 decimal places
- Multiple jobs can be processed concurrently
