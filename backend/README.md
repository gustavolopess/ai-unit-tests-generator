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

## API Endpoints

The service uses a job-based asynchronous architecture. Analysis jobs are created immediately and processed in the background.

### POST /coverage/analyze

Creates a new analysis job for a GitHub repository. Returns immediately with a job ID.

**Request Body:**
```json
{
  "repositoryUrl": "https://github.com/username/repository.git"
}
```

**Response (HTTP 202 Accepted):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created and processing started"
}
```

### GET /coverage/jobs/:jobId/result

Gets the coverage analysis job status and results, including real-time output from Claude CLI.

**Job Statuses:**
- `PENDING`: Job created, waiting to start
- `CLONING`: Repository is being cloned
- `INSTALLING`: Installing npm dependencies
- `ANALYZING`: Claude is analyzing the repository
- `COMPLETED`: Analysis finished successfully
- `FAILED`: Analysis failed (check error field)

**Response (when processing or completed):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "COMPLETED",
  "totalFiles": 15,
  "averageCoverage": 67.5,
  "files": [
    {
      "file": "src/index.ts",
      "coverage": 85.5
    },
    {
      "file": "src/utils.ts",
      "coverage": 42.0
    }
  ],
  "error": null,
  "output": [
    "Cloning repository...",
    "Repository cloned to /tmp/repo-xyz123",
    "Starting Claude analysis...",
    "Analysis completed, processing results...",
    "Job completed. Repository kept for test generation. Use cleanup endpoint when done."
  ]
}
```

**Note:** The response includes the current status and real-time output. Poll this endpoint to monitor job progress. When `status` is `FAILED`, check the `error` field for details.

## How It Works

The service uses an asynchronous job-based architecture:

1. **Job Creation**: When you POST to `/coverage/analyze`, a job is created immediately and a job ID is returned. The job starts processing in the background.

2. **Repository Cloning** (Status: CLONING): The service clones the specified GitHub repository into a temporary directory using Git.

3. **Dependency Installation** (Status: INSTALLING): The service runs `npm install` in the cloned repository to install all dependencies needed for running tests.

4. **Claude Analysis** (Status: ANALYZING): The Claude CLI is executed in the cloned repository directory with a prompt that instructs it to:
   - Check for existing test pipelines (npm test, jest, etc.)
   - If tests exist, run them with coverage enabled
   - If no test pipeline exists, set up Jest and run tests
   - If no tests exist, return 0% coverage for all source files
   - Output results in JSON format

5. **Coverage Parsing**: The service parses Claude's JSON output to extract coverage data per file.

6. **Job Completion** (Status: COMPLETED): Results are stored in the job and can be retrieved via the `/jobs/:jobId/result` endpoint.

7. **Cleanup**: The temporary directory is automatically cleaned up after analysis (success or failure).

## Example Usage

### Step 1: Create a job

```bash
curl -X POST http://localhost:3000/coverage/analyze \
  -H "Content-Type: application/json" \
  -d '{"repositoryUrl": "https://github.com/username/repository.git"}'
```

Response:
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "PENDING",
  "message": "Job created and processing started"
}
```

### Step 2: Monitor job progress and get results

Poll the result endpoint to check the job status and see real-time output:

```bash
curl http://localhost:3000/coverage/jobs/550e8400-e29b-41d4-a716-446655440000/result
```

Response (while processing):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "ANALYZING",
  "totalFiles": null,
  "averageCoverage": null,
  "files": null,
  "error": null,
  "output": [
    "Cloning repository https://github.com/username/repository.git...",
    "Repository cloned to /tmp/repo-xyz123",
    "Starting Claude analysis...",
    "Checking for test configuration...",
    "Running npm test -- --coverage..."
  ]
}
```

Response (when completed):
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "repositoryUrl": "https://github.com/username/repository.git",
  "status": "COMPLETED",
  "totalFiles": 15,
  "averageCoverage": 67.5,
  "files": [
    {
      "file": "src/index.ts",
      "coverage": 85.5
    },
    {
      "file": "src/utils.ts",
      "coverage": 42.0
    }
  ],
  "error": null,
  "output": [
    "Cloning repository...",
    "Repository cloned to /tmp/repo-xyz123",
    "Starting Claude analysis...",
    "Analysis completed, processing results...",
    "Job completed. Repository kept for test generation. Use cleanup endpoint when done."
  ]
}
```

## Complete Workflow: From Analysis to PR

This service supports a complete workflow from analyzing coverage to automatically creating pull requests with generated tests.

### Step 1: Analyze Repository Coverage

```bash
curl -X POST http://localhost:3000/coverage/analyze \
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
curl http://localhost:3000/coverage/jobs/analysis-abc-123/result
```

From the response, identify files with low coverage (e.g., `src/utils/helpers.ts` with 42% coverage).

### Step 3: Generate Tests for Low Coverage File

```bash
curl -X POST http://localhost:3000/coverage/jobs/analysis-abc-123/generate-tests \
  -H "Content-Type: application/json" \
  -d '{"filePath": "src/utils/helpers.ts"}'
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
curl http://localhost:3000/coverage/test-jobs/test-def-456/result
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
curl -X POST http://localhost:3000/coverage/test-jobs/test-def-456/create-pr
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
curl http://localhost:3000/coverage/pr-jobs/pr-ghi-789/result
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

### Step 7: Cleanup (When Done)

```bash
curl -X DELETE http://localhost:3000/coverage/jobs/analysis-abc-123
```

**Note:** The cleanup will delete the cloned repository and all associated jobs (analysis, test generation, and PR creation).

## Advanced Features

### Monorepo Support with Entrypoint

For repositories where the source code is in a subdirectory:

```bash
curl -X POST http://localhost:3000/coverage/analyze \
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
