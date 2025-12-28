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

The service uses a job-based asynchronous architecture with three types of jobs:

1. **coverage-analyzer**: Clones repository and analyzes test coverage
2. **tests-generator**: Generates unit tests for specific files  
3. **pr-creator**: Creates GitHub pull requests with generated tests

All job endpoints follow the pattern: `/jobs/{job-type}/start` to create jobs and `/jobs/{job-type}/:jobId/result` to get results.

### Coverage Analyzer Jobs

#### POST /jobs/coverage-analyzer/start

Starts a coverage analyzer job for a GitHub repository.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/username/repository.git",
  "entrypoint": "packages/api"  // Optional: subdirectory for monorepos
}
```

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Coverage analyzer job created and started"
}
```

#### GET /jobs/coverage-analyzer/:jobId/result

Gets coverage analyzer job status and results. Poll this endpoint to monitor progress.

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "COMPLETED",
  "totalFiles": 15,
  "averageCoverage": 67.5,
  "files": [
    {"file": "src/index.ts", "coverage": 85.5},
    {"file": "src/utils.ts", "coverage": 42.0}
  ],
  "error": null,
  "output": [
    "Cloning repository...",
    "Repository cloned",
    "Starting Claude analysis...",
    "Analysis completed"
  ]
}
```

**Job Statuses:**
- `PENDING`: Job created
- `CLONING`: Cloning repository
- `INSTALLING`: Installing dependencies
- `ANALYZING`: Analyzing coverage
- `COMPLETED`: Analysis complete
- `FAILED`: Analysis failed

### Test Generator Jobs

#### POST /jobs/tests-generator/start

Starts a test generator job for a specific file.

**Request Body:**
```json
{
  "coverageAnalyzerJobId": "550e8400-e29b-41d4-a716-446655440000",
  "filePath": "src/utils/helpers.ts"
}
```

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440001",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Test generator job created for src/utils/helpers.ts"
}
```

#### GET /jobs/tests-generator/:jobId/result

Gets test generator job status and results.

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440001",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "TEST_GENERATION_COMPLETED",
  "parentJobId": "550e8400-e29b-41d4-a716-446655440000",
  "targetFilePath": "src/utils/helpers.ts",
  "testGenerationResult": {
    "filePath": "src/utils/helpers.ts",
    "summary": "Created test file with 15 tests. Coverage improved from 42% to 87%.",
    "testFilePath": "src/utils/helpers.spec.ts",
    "coverage": 87
  },
  "error": null,
  "output": [
    "Starting test generation...",
    "Session ID: xyz-789",
    "Test generation completed"
  ]
}
```

**Job Statuses:**
- `PENDING`: Job created
- `GENERATING_TESTS`: Generating tests
- `TEST_GENERATION_COMPLETED`: Tests generated
- `TEST_GENERATION_FAILED`: Generation failed

### PR Creator Jobs

#### POST /jobs/pr-creator/start

Starts a PR creator job to create a GitHub pull request.

**Request Body:**
```json
{
  "testGeneratorJobId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Response (HTTP 202):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440002",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "PR creator job created and started"
}
```

#### GET /jobs/pr-creator/:jobId/result

Gets PR creator job status and results.

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440002",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PR_CREATED",
  "parentJobId": "550e8400-e29b-41d4-a716-446655440001",
  "prCreationResult": {
    "prUrl": "https://github.com/username/repository/pull/42",
    "prNumber": 42,
    "summary": "Created pull request with comprehensive unit tests..."
  },
  "error": null,
  "output": [
    "Creating pull request...",
    "Using session ID: xyz-789",
    "PR created: https://github.com/username/repository/pull/42"
  ]
}
```

**Job Statuses:**
- `PENDING`: Job created
- `CREATING_PR`: Creating PR
- `PR_CREATED`: PR created successfully
- `PR_CREATION_FAILED`: PR creation failed

## How It Works

The service uses an asynchronous job-based architecture:

1. **Job Creation**: POST to `/jobs/{type}/start` creates a job and returns immediately with a job ID. The job starts processing in the background.

2. **Repository Cloning** (Coverage Analyzer): The service clones the specified GitHub repository into a temporary directory.

3. **Dependency Installation**: Runs `npm install` in the repository (or entrypoint subdirectory).

4. **Claude Analysis**: Executes Claude CLI to analyze test coverage or generate tests.

5. **Job Completion**: Results are stored and can be retrieved via `/jobs/{type}/:jobId/result`.

6. **Cleanup**: Use the cleanup endpoint when done with all jobs (to be implemented).

## Example Usage

### Basic Coverage Analysis

```bash
# Start coverage analyzer
curl -X POST http://localhost:3000/jobs/coverage-analyzer/start \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/username/repository.git"}'

# Response: {"jobId": "job-1", ...}

# Check result
curl http://localhost:3000/jobs/coverage-analyzer/job-1/result
```



## Complete Workflow: From Analysis to PR

This service supports a complete workflow from analyzing coverage to automatically creating pull requests with generated tests.

### Step 1: Analyze Repository Coverage

```bash
curl -X POST http://localhost:3000/jobs/coverage-analyzer/start \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/username/repository.git"}'
```

Response:
```json
{
  "jobId": "analysis-abc-123",
  "status": "PENDING",
  "message": "Job created and processing started"
}
```

### Step 2: Monitor Analysis and Get Results

Poll the result endpoint until `status` is `COMPLETED`:

```bash
curl http://localhost:3000/jobs/coverage-analyzer/analysis-abc-123/result
```

From the response, identify files with low coverage (e.g., `src/utils/helpers.ts` with 42% coverage).

### Step 3: Generate Tests for Low Coverage File

```bash
curl -X POST http://localhost:3000/jobs/tests-generator/start \
  -H "Content-Type: application/json" \
  -d '{
    "coverageAnalyzerJobId": "analysis-abc-123",
    "filePath": "src/utils/helpers.ts"
  }'
```

Response:
```json
{
  "jobId": "test-def-456",
  "status": "PENDING",
  "message": "Test generation job created for src/utils/helpers.ts"
}
```

### Step 4: Monitor Test Generation and Get Results

Poll the result endpoint to watch progress:

```bash
curl http://localhost:3000/jobs/tests-generator/test-def-456/result
```

Watch the `status` field change from `GENERATING_TESTS` to `TEST_GENERATION_COMPLETED`, and the `output` field for real-time progress including "Session ID saved: xyz-789".

Response (when completed):
```json
{
  "jobId": "test-def-456",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "TEST_GENERATION_COMPLETED",
  "parentJobId": "analysis-abc-123",
  "targetFilePath": "src/utils/helpers.ts",
  "testGenerationResult": {
    "filePath": "src/utils/helpers.ts",
    "summary": "Created test file at src/utils/helpers.spec.ts with 15 tests. Coverage improved from 42% to 87%.",
    "testFilePath": "src/utils/helpers.spec.ts",
    "coverage": 87
  },
  "error": null,
  "output": [
    "Starting test generation for src/utils/helpers.ts...",
    "[Claude] ...",
    "Test generation completed",
    "Session ID: xyz-789",
    "Test generation completed successfully"
  ]
}
```

### Step 5: Create Pull Request with Changes

```bash
curl -X POST http://localhost:3000/jobs/pr-creator/start \
  -H "Content-Type: application/json" \
  -d '{"testGeneratorJobId": "test-def-456"}'
```

Response:
```json
{
  "jobId": "pr-ghi-789",
  "status": "PENDING",
  "message": "PR creation job started"
}
```

### Step 6: Monitor PR Creation and Get Result

Poll the result endpoint to watch PR creation progress:

```bash
curl http://localhost:3000/jobs/pr-creator/pr-ghi-789/result
```

Watch the `status` change from `CREATING_PR` to `PR_CREATED`, and monitor the `output` for real-time progress.

Response (when completed):
```json
{
  "jobId": "pr-ghi-789",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PR_CREATED",
  "parentJobId": "test-def-456",
  "prCreationResult": {
    "prUrl": "https://github.com/username/repository/pull/42",
    "prNumber": 42,
    "summary": "Created pull request with comprehensive unit tests for src/utils/helpers.ts..."
  },
  "error": null,
  "output": [
    "Creating pull request...",
    "Using session ID: xyz-789",
    "[Claude] ...",
    "PR created: https://github.com/username/repository/pull/42",
    "Pull request created successfully: https://github.com/username/repository/pull/42"
  ]
}
```

## Advanced Features

### Monorepo Support with Entrypoint

For repositories where the source code is in a subdirectory:

```bash
curl -X POST http://localhost:3000/jobs/coverage-analyzer/start \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryUrl": "https://github.com/org/monorepo.git",
    "entrypoint": "packages/backend"
  }'
```

This will run `npm install` and all analysis in the `packages/backend` directory.

### Session Continuity

Test generation jobs capture a Claude CLI session ID, which is then reused for PR creation. This ensures:
- Claude remembers the context of test generation
- PR descriptions are comprehensive and accurate
- All changes are properly documented

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
