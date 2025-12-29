# Database Design Documentation

## Overview

This application uses SQLite with TypeORM for data persistence. The database follows Domain-Driven Design (DDD) principles with bounded contexts for Job Processing, Repository Analysis, and Test Generation.

## Design Decisions

### 1. Output Storage: Log Files Instead of Database

**Decision:** Job outputs are stored in log files (`data/logs/<job_id>.log`) instead of database columns.

**Rationale:**
- **Performance**: Large output arrays bloat database size and slow down queries
- **Scalability**: File-based logs support unbounded growth without affecting database performance
- **Standard tooling**: Log files can be viewed with standard tools (tail, grep, log viewers)
- **Separation of concerns**: Transactional data (job state) is separate from operational data (logs)

**Implementation:**
- `JobLogService` handles all log file operations
- `AppendJobLogCommand` writes to log files
- `GetJobLogsQuery` reads from log files
- Job entity has a `log_path` column referencing the log file

### 2. Foreign Key Relationship: Jobs → Repositories

**Decision:** Jobs table has a foreign key `repository_id` pointing to the `repositories` table.

**Rationale:**
- **Normalization**: Eliminates duplication of `repository_url` and `entrypoint` across multiple jobs
- **Referential integrity**: Database enforces that jobs cannot reference non-existent repositories
- **Data consistency**: Repository metadata is the single source of truth
- **Query efficiency**: Can join jobs with repositories for complete information

**Trade-offs:**
- **Tight coupling**: Creates a dependency between Job Processing and Repository Analysis bounded contexts
- **Acceptable because**: Both contexts are in the same database, managed by the same team, and have naturally related lifecycles

**Pattern Used:** Shared Kernel pattern (pragmatic DDD for small teams/single database)

### 3. Dual Coverage Storage: Historical Tracking

**Decision:** Coverage data is stored in TWO locations:
1. `jobs.coverage_result` (JSON column) - Snapshot at job execution time
2. `file_coverages` table - Current/latest coverage per file per repository

**Rationale:**
- **Historical tracking**: Jobs preserve what coverage was when they executed
- **Audit trail**: Can answer "what was coverage on date X?" by looking at jobs from that period
- **Latest state**: `file_coverages` provides current repository coverage without joining jobs
- **Different lifecycles**: Job snapshots are immutable; repository coverage gets updated on re-analysis

**Update Strategy:**
- `jobs.coverage_result`: Written once when job completes, never updated (immutable snapshot)
- `file_coverages`: REPLACE strategy on re-analysis (deletes old entries, inserts new ones)
- `repositories.average_coverage`: Recalculated from `file_coverages` on each analysis

**Trade-offs:**
- **Data duplication**: Coverage data exists in multiple places
- ✅ **Acceptable because**: Serves different purposes (historical vs current), supports time-series analysis
- **Query flexibility**: Can get coverage from current repository state OR from historical job execution

**Example Use Cases:**
```sql
-- Get current coverage for a repository
SELECT * FROM file_coverages WHERE repository_id = ?;

-- Get historical coverage from a specific job execution
SELECT coverage_result FROM jobs WHERE id = ?;

-- Track coverage trends over time
SELECT created_at, coverage_result->>'averageCoverage' as coverage
FROM jobs
WHERE repository_id = ?
ORDER BY created_at;
```

## Database Schema

### Tables

#### `repositories`
Stores information about Git repositories being analyzed.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | Repository UUID |
| `url` | VARCHAR(500) | UNIQUE, NOT NULL, INDEX | Git repository URL |
| `entrypoint` | VARCHAR(255) | NULLABLE | Subdirectory to analyze (e.g., "backend") |
| `local_path` | VARCHAR(500) | NULLABLE | Path to cloned repository on disk |
| `status` | VARCHAR(50) | NOT NULL, INDEX | Repository status (PENDING, CLONING, CLONED, etc.) |
| `created_at` | DATETIME | NOT NULL | When repository was first added |
| `updated_at` | DATETIME | NOT NULL | Last modification timestamp |
| `cloned_at` | DATETIME | NULLABLE | When repository was successfully cloned |
| `last_analyzed_at` | DATETIME | NULLABLE | Last coverage analysis timestamp |
| `average_coverage` | DECIMAL(5,2) | NULLABLE | Overall test coverage percentage |

**Indexes:**
- PRIMARY: `id`
- INDEX: `url` (for lookups by repository URL)
- INDEX: `status` (for querying repositories by state)

#### `jobs`
Represents job execution tracking (analysis, test generation, PR creation).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | Job UUID |
| `repository_id` | VARCHAR(36) | FOREIGN KEY → repositories(id), NOT NULL, INDEX | Reference to repository being processed |
| `parent_job_id` | VARCHAR(36) | NULLABLE, INDEX | Parent job for reusing analysis results |
| `target_file_path` | VARCHAR(500) | NULLABLE | Specific file for test generation |
| `status` | VARCHAR(50) | NOT NULL, INDEX | Job status (PENDING, CLONING, INSTALLING, etc.) |
| `created_at` | DATETIME | NOT NULL, INDEX | Job creation timestamp |
| `updated_at` | DATETIME | NOT NULL | Last update timestamp |
| `started_at` | DATETIME | NULLABLE | When job execution started |
| `completed_at` | DATETIME | NULLABLE | When job finished (success or failure) |
| `log_path` | VARCHAR(500) | NULLABLE | Path to log file (e.g., "data/logs/<job_id>.log") |
| `error` | TEXT | NULLABLE | Error message if job failed |
| `repository_path` | VARCHAR(500) | NULLABLE | Local path to cloned repository |
| `session_id` | VARCHAR(255) | NULLABLE | Claude API session ID for test generation |
| `test_generation_request_id` | VARCHAR(36) | NULLABLE | ID of test generation request |
| `coverage_result` | JSON | NULLABLE | Coverage analysis results |
| `test_generation_result` | JSON | NULLABLE | Test generation results |
| `pr_creation_result` | JSON | NULLABLE | Pull request creation results |

**Indexes:**
- PRIMARY: `id`
- FOREIGN KEY: `repository_id` → `repositories(id)` ON DELETE CASCADE
- INDEX: `repository_id` (for finding all jobs for a repository)
- INDEX: `parent_job_id` (for finding child jobs)
- INDEX: `status` (for querying jobs by state)
- INDEX: `created_at` (for sorting jobs chronologically)

**JSON Columns:**

`coverage_result`:
```json
{
  "totalFiles": 150,
  "averageCoverage": 78.5,
  "files": [
    {"file": "src/foo.ts", "coverage": 85.2},
    ...
  ]
}
```

`test_generation_result`:
```json
{
  "filePath": "src/service.ts",
  "testFilePath": "src/service.test.ts",
  "coverage": 92.3
}
```

`pr_creation_result`:
```json
{
  "prUrl": "https://github.com/owner/repo/pull/123",
  "prNumber": 123
}
```

#### `file_coverages`
Stores per-file coverage metrics for repositories.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | Coverage entry UUID |
| `repository_id` | VARCHAR(36) | FOREIGN KEY → repositories(id), NOT NULL, INDEX | Repository reference |
| `file_path` | VARCHAR(500) | NOT NULL | Relative path to source file |
| `coverage_percentage` | DECIMAL(5,2) | NOT NULL, INDEX | Coverage percentage for this file |
| `lines_covered` | INTEGER | NULLABLE | Number of covered lines |
| `lines_total` | INTEGER | NULLABLE | Total number of lines |
| `created_at` | DATETIME | NOT NULL | When coverage was measured |

**Indexes:**
- PRIMARY: `id`
- FOREIGN KEY: `repository_id` → `repositories(id)` ON DELETE CASCADE
- UNIQUE INDEX: `(repository_id, file_path)` (one coverage entry per file per repository)
- INDEX: `repository_id`
- INDEX: `coverage_percentage` (for finding low-coverage files)

#### `test_generation_requests`
Tracks test generation requests made to Claude API.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| `id` | VARCHAR(36) | PRIMARY KEY | Request UUID |
| `repository_id` | VARCHAR(500) | NOT NULL, INDEX | Repository identifier |
| `target_file_path` | VARCHAR(500) | NOT NULL | File to generate tests for |
| `working_directory` | VARCHAR(500) | NOT NULL | Working directory for test generation |
| `status` | VARCHAR(50) | NOT NULL, INDEX | Request status |
| `created_at` | DATETIME | NOT NULL | Request creation time |
| `completed_at` | DATETIME | NULLABLE | Request completion time |
| `session_id` | VARCHAR(255) | NULLABLE, INDEX | Claude API session ID |
| `test_file_path` | VARCHAR(500) | NULLABLE | Generated test file path |
| `coverage` | DECIMAL(5,2) | NULLABLE | Achieved coverage percentage |
| `error` | TEXT | NULLABLE | Error message if failed |
| `pull_request` | JSON | NULLABLE | PR information if created |

**Indexes:**
- PRIMARY: `id`
- INDEX: `repository_id`
- INDEX: `status`
- INDEX: `session_id`

## Relationships

```
repositories (1) ←──→ (N) file_coverages
     │
     │ (1)
     │
     ↓
    (N) jobs
     │
     │ (parent-child)
     └──→ jobs.parent_job_id
```

- **One repository** can have **many jobs**
- **One repository** can have **many file coverage entries**
- **Jobs** can reference a **parent job** for reusing analysis results
- Jobs are deleted when their repository is deleted (CASCADE)

## Migration Strategy

Since this is a local development database, migrations are handled via TypeORM's `synchronize: true` option, which auto-creates/updates tables on startup.

**For production**, this should be replaced with proper migrations:
```typescript
// Disable synchronize
synchronize: false,

// Use migrations
migrations: ['dist/migrations/*.js'],
migrationsRun: true,
```

## Query Patterns

### Common Queries

**Find all jobs for a repository:**
```sql
SELECT * FROM jobs WHERE repository_id = ?
```

**Find low-coverage files:**
```sql
SELECT * FROM file_coverages
WHERE repository_id = ? AND coverage_percentage < 50
ORDER BY coverage_percentage ASC
```

**Find child jobs of a parent:**
```sql
SELECT * FROM jobs WHERE parent_job_id = ?
```

**Get repository with average coverage:**
```sql
SELECT url, average_coverage
FROM repositories
WHERE id = ?
```

## Performance Considerations

1. **Indexes on FK columns**: All foreign keys are indexed for efficient joins
2. **Status indexes**: Frequently queried status columns are indexed
3. **Timestamp indexes**: `created_at` indexed for chronological sorting
4. **Unique constraints**: Prevent duplicate data (e.g., same file coverage entry)
5. **Log files**: Keep database size small by externalizing large text data

## Future Enhancements

Potential improvements for production use:

1. **Add migrations**: Replace `synchronize: true` with proper migration system
2. **Add soft deletes**: Keep historical records instead of hard deleting
3. **Add audit columns**: Track who created/modified records
4. **Partition log files**: Archive old logs by date
5. **Add database-level constraints**: CHECK constraints for status enums
6. **Connection pooling**: Configure for high concurrency
7. **Read replicas**: Separate read/write workloads for scalability
