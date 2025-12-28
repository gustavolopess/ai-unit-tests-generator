import { Injectable, Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';

export interface RepositoryCacheEntry {
  repositoryUrl: string;
  clonedPath: string;
  lastUsed: Date;
}

/**
 * Service to manage cached repository clones
 * Maps repository URLs to their cloned filesystem paths
 */
@Injectable()
export class RepositoryCacheService {
  private readonly logger = new Logger(RepositoryCacheService.name);
  private readonly cache = new Map<string, RepositoryCacheEntry>();

  /**
   * Get the cached path for a repository if it exists and is still valid
   */
  getCachedPath(repositoryUrl: string): string | null {
    const normalizedUrl = this.normalizeUrl(repositoryUrl);
    const entry = this.cache.get(normalizedUrl);

    if (!entry) {
      this.logger.debug(`No cache entry for ${repositoryUrl}`);
      return null;
    }

    // Verify the directory still exists
    if (!existsSync(entry.clonedPath)) {
      this.logger.warn(
        `Cached path ${entry.clonedPath} no longer exists, removing from cache`,
      );
      this.cache.delete(normalizedUrl);
      return null;
    }

    this.logger.log(`Cache hit for ${repositoryUrl}: ${entry.clonedPath}`);

    // Update last used timestamp
    entry.lastUsed = new Date();

    return entry.clonedPath;
  }

  /**
   * Store a repository clone path in the cache
   */
  setCachedPath(repositoryUrl: string, clonedPath: string): void {
    const normalizedUrl = this.normalizeUrl(repositoryUrl);

    const entry: RepositoryCacheEntry = {
      repositoryUrl: normalizedUrl,
      clonedPath,
      lastUsed: new Date(),
    };

    this.cache.set(normalizedUrl, entry);

    this.logger.log(
      `Cached repository ${repositoryUrl} at ${clonedPath}`,
    );
  }

  /**
   * Remove a repository from the cache
   */
  removeCachedPath(repositoryUrl: string): void {
    const normalizedUrl = this.normalizeUrl(repositoryUrl);
    this.cache.delete(normalizedUrl);
    this.logger.log(`Removed ${repositoryUrl} from cache`);
  }

  /**
   * Get all cached repositories
   */
  getAllCached(): RepositoryCacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared ${count} entries from repository cache`);
  }

  /**
   * Normalize repository URL for consistent caching
   * Removes .git suffix and trailing slashes
   */
  private normalizeUrl(url: string): string {
    return url
      .replace(/\.git$/, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    entries: Array<{
      url: string;
      path: string;
      lastUsed: Date;
      exists: boolean;
    }>;
  } {
    const entries = Array.from(this.cache.values()).map((entry) => ({
      url: entry.repositoryUrl,
      path: entry.clonedPath,
      lastUsed: entry.lastUsed,
      exists: existsSync(entry.clonedPath),
    }));

    return {
      totalEntries: this.cache.size,
      entries,
    };
  }
}
