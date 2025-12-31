import { join } from 'path';

/**
 * Centralized application configuration
 * All environment variables are read here to provide a single source of truth
 */
export const AppConfig = {
  /**
   * Server configuration
   */
  server: {
    /** Port the server will listen on */
    port: parseInt(process.env.PORT || '3000', 10),

    /** Current environment */
    nodeEnv: process.env.NODE_ENV || 'development',

    /** Whether running in development mode */
    isDevelopment: process.env.NODE_ENV === 'development',

    /** Whether running in production mode */
    isProduction: process.env.NODE_ENV === 'production',

    /** Allowed CORS origins */
    allowedOrigins: (
      process.env.ALLOWED_ORIGINS ||
      'http://localhost:3001,http://localhost:5173'
    ).split(','),
  },

  /**
   * Database configuration
   */
  database: {
    /** Path to SQLite database file */
    path: process.env.DATABASE_PATH || 'data/github-coverage.db',

    /** Whether to enable SQL logging */
    logging: process.env.NODE_ENV === 'development',

    /** Whether to auto-sync schema (disable in production!) */
    synchronize: process.env.NODE_ENV !== 'production',
  },

  /**
   * Coverage analysis configuration
   */
  coverage: {
    /** Coverage threshold percentage - files below this are flagged for improvement */
    threshold: parseInt(process.env.COVERAGE_THRESHOLD || '80', 10),
  },

  /**
   * Job processing configuration
   */
  jobs: {
    /** Directory for job log files */
    logsDir: process.env.LOGS_DIR || join(process.cwd(), 'data', 'logs'),

    /** Lock timeout in milliseconds (default: 5 minutes) */
    lockTimeoutMs: parseInt(process.env.LOCK_TIMEOUT_MS || '300000', 10),
  },
} as const;
