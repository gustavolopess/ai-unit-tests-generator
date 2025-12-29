# Database Migration Status

## Summary

This document tracks the migration from in-memory storage to SQLite with improved database design (FK relationships and log files).

## Completed Changes

### ✅ Infrastructure
- Created `JobLogService` for file-based logging ([job-log.service.ts](backend/src/bounded-contexts/job-processing/infrastructure/job-log.service.ts))
- Log files stored in `data/logs/<job_id>.log` with timestamps
- Automatic log directory creation on service initialization

### ✅ Database Schema
- Updated `JobEntity` with:
  - `repository_id` (FK to repositories table)
  - `log_path` (reference to log file)
  - Removed `output` array column
  - Removed `repositoryUrl` and `entrypoint` columns
- Added FK relationship: `jobs.repository_id` → `repositories.id` with CASCADE delete
- Added indexes on `repository_id` for efficient joins

### ✅ Domain Model
- Updated `Job` entity to use `repositoryId` instead of `repositoryUrl`/`entrypoint`
- Removed `output` array property
- Added `logPath` property
- Changed `Job.create()` signature to accept `repositoryId`
- Updated null checks to handle TypeORM's `null` values (using `== null` pattern)

### ✅ Commands & Handlers
- Created `AppendJobLogCommand` and handler for writing to log files
- Created `GetJobLogsQuery` and handler for reading from log files
- Updated `CreateJobCommand` to accept `repositoryId` instead of `repositoryUrl`
- Updated all command handlers to work with new schema
- Registered `JobLogService` in `JobProcessingModule`
- **Fixed:** `AppendJobLogHandler` now sets `log_path` column on first log write

### ✅ Repository Mappersers
- Updated `TypeOrmJobRepository` to map `repositoryId` and `logPath`
- Removed mappings for `repositoryUrl`, `entrypoint`, and `output`

### ✅ Database
- Dropped old database file (`data/github-coverage.db`)
- Cleared old log directories
- Fresh start with new schema

### ✅ Documentation
- Created comprehensive [DATABASE_DESIGN.md](DATABASE_DESIGN.md) with:
  - Design decisions and rationale
  - Complete schema documentation
  - Relationship diagrams
  - Query patterns
  - Performance considerations

## Remaining Work

### ✅ Coverage Service (Complete)
**File:** `backend/src/coverage/coverage.service.ts`

**Status:** Fully updated
- ✅ Replaced all `AppendJobOutputCommand` with `AppendJobLogCommand`
- ✅ All methods now fetch Repository entity via `GetRepositoryQuery`
- ✅ Using `repository.url.getValue()` and `repository.entrypoint`

**Updated methods:**
- ✅ `cloneRepositoryStage()` - fetches repository to get URL
- ✅ `installDependenciesStage()` - fetches repository to get entrypoint
- ✅ `analyzeCoverageStage()` - fetches repository, removed obsolete CloneRepositoryCommand
- ✅ `generateTestsStage()` - fetches repository to get entrypoint and URL

### ⚠️ Coverage Controller (Partial)
**File:** `backend/src/coverage/coverage.controller.ts`

**Status:** Partially updated
- ✅ Updated `createJob()` to call `CloneRepositoryCommand` first
- ✅ Updated `getJobResult()` to fetch logs via `GetJobLogsQuery`
- ⚠️ Using placeholder `'unknown'` for `repositoryUrl` in responses
- ❌ Needs to fetch Repository entity to return actual URL

**Required changes:**
```typescript
// In createJob() - line 74 and getJobResult() - line 135
const repository = await this.queryBus.execute(
  new GetRepositoryQuery(job.repositoryId)
);
const repositoryUrl = repository.url;
```

### ❌ Other Potential Issues

**Test Generation Service:**
- May reference `job.repositoryUrl` if it creates child jobs
- Need to verify and update if necessary

**Event Handlers:**
- `JobCreatedEvent` still passes `repositoryUrl` as parameter (line 62 in job.entity.ts)
- Should be updated to pass `repositoryId` or repository details differently

## Testing Plan

Once migration is complete:

1. **Start fresh:**
   ```bash
   rm -f data/github-coverage.db data/logs/*
   npm run start:dev
   ```

2. **Test job creation:**
   ```bash
   curl -X POST http://localhost:3000/jobs \
     -H "Content-Type: application/json" \
     -d '{"repositoryUrl": "https://github.com/user/repo", "entrypoint": "backend"}'
   ```

3. **Verify:**
   - Repository created in database
   - Job created with correct `repository_id` FK
   - Log file created in `data/logs/<job_id>.log`
   - Logs written to file during execution
   - Job status updates correctly

4. **Test child job creation:**
   ```bash
   curl -X POST http://localhost:3000/jobs \
     -H "Content-Type: application/json" \
     -d '{"jobId": "<parent_job_id>", "targetFilePath": "src/file.ts"}'
   ```

5. **Verify child job:**
   - References same `repository_id` as parent
   - Has separate log file
   - Inherits analysis results from parent

## Quick Fix Script

To complete the migration, update `coverage.service.ts`:

```typescript
// Add import
import { GetRepositoryQuery } from '../bounded-contexts/repository-analysis/application/queries';

// Update cloneRepositoryStage():
private async cloneRepositoryStage(jobId: string): Promise<void> {
  const job = await this.queryBus.execute(new GetJobQuery(jobId));
  const repository = await this.queryBus.execute(new GetRepositoryQuery(job.repositoryId));

  const cachedPath = this.repositoryCache.getCachedPath(repository.url);
  // ... use repository.url and repository.entrypoint everywhere
}

// Update installDependenciesStage():
private async installDependenciesStage(jobId: string): Promise<void> {
  const job = await this.queryBus.execute(new GetJobQuery(jobId));
  const repository = await this.queryBus.execute(new GetRepositoryQuery(job.repositoryId));

  const workDir = repository.entrypoint
    ? `${job.repositoryPath}/${repository.entrypoint}`
    : job.repositoryPath!;
  // ...
}

// Similar pattern for analyzeCoverageStage() and generateTestsStage()
```

## Rollback Plan

If issues arise, rollback is simple since this is local development:

```bash
git checkout HEAD -- backend/src
rm -f data/github-coverage.db data/logs/*
npm run build
npm run start:dev
```

## Notes

- **No production impact**: This is local development only
- **Breaking changes**: Old database format is incompatible (intentional clean slate)
- **Performance improvement**: Log files prevent database bloat
- **Better design**: FK relationships ensure referential integrity
