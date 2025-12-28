import { Controller, Get, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { RepositoryCacheService } from './infrastructure/repository-cache.service';

@ApiTags('repository-cache')
@Controller('repository-cache')
export class RepositoryCacheController {
  constructor(private readonly cacheService: RepositoryCacheService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get repository cache statistics',
    description: 'Returns information about cached repositories',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cache statistics retrieved successfully',
  })
  getStats() {
    return this.cacheService.getStats();
  }

  @Get()
  @ApiOperation({
    summary: 'Get all cached repositories',
    description: 'Returns a list of all cached repository entries',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cached repositories retrieved successfully',
  })
  getAllCached() {
    return this.cacheService.getAllCached();
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Clear all repository cache',
    description: 'Removes all entries from the repository cache',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Cache cleared successfully',
  })
  clearCache() {
    this.cacheService.clearCache();
  }

  @Delete(':repositoryUrl')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove specific repository from cache',
    description: 'Removes a specific repository URL from the cache',
  })
  @ApiParam({
    name: 'repositoryUrl',
    description: 'The repository URL to remove (URL encoded)',
    example: 'https%3A%2F%2Fgithub.com%2Fusername%2Frepo.git',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Repository removed from cache successfully',
  })
  removeCached(@Param('repositoryUrl') repositoryUrl: string) {
    const decodedUrl = decodeURIComponent(repositoryUrl);
    this.cacheService.removeCachedPath(decodedUrl);
  }
}
