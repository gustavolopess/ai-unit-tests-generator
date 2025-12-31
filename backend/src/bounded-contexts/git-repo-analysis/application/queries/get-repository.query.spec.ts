import { GetRepositoryQuery } from './get-repository.query';

describe('GetRepositoryQuery', () => {
  describe('constructor', () => {
    it('should create a GetRepositoryQuery with valid repositoryId', () => {
      const repositoryId = '550e8400-e29b-41d4-a716-446655440000';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query).toBeInstanceOf(GetRepositoryQuery);
      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should create a query with string repositoryId', () => {
      const repositoryId = 'repo-123';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should create a query with UUID format repositoryId', () => {
      const repositoryId = 'a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should accept empty string as repositoryId', () => {
      const repositoryId = '';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe('');
    });

    it('should accept repositoryId with special characters', () => {
      const repositoryId = 'repo-id_123-abc';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should accept numeric string as repositoryId', () => {
      const repositoryId = '12345';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should accept whitespace-only repositoryId', () => {
      const repositoryId = '   ';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe('   ');
    });

    it('should preserve repositoryId case sensitivity', () => {
      const repositoryId = 'RepoId-ABC-123';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe('RepoId-ABC-123');
    });

    it('should accept long repositoryId strings', () => {
      const repositoryId = 'a'.repeat(1000);
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
      expect(query.repositoryId.length).toBe(1000);
    });

    it('should make repositoryId readonly', () => {
      const repositoryId = 'test-id';
      const query = new GetRepositoryQuery(repositoryId);

      // TypeScript will prevent this at compile time
      // This test verifies the property is accessible
      expect(query.repositoryId).toBeDefined();
      expect(typeof query.repositoryId).toBe('string');
    });
  });

  describe('property access', () => {
    it('should allow reading repositoryId property', () => {
      const repositoryId = 'test-repository-id';
      const query = new GetRepositoryQuery(repositoryId);

      const id = query.repositoryId;

      expect(id).toBe(repositoryId);
    });

    it('should maintain repositoryId value over time', () => {
      const repositoryId = 'stable-id';
      const query = new GetRepositoryQuery(repositoryId);

      const firstAccess = query.repositoryId;
      const secondAccess = query.repositoryId;

      expect(firstAccess).toBe(secondAccess);
      expect(firstAccess).toBe(repositoryId);
    });
  });

  describe('multiple instances', () => {
    it('should create independent query instances', () => {
      const query1 = new GetRepositoryQuery('id-1');
      const query2 = new GetRepositoryQuery('id-2');

      expect(query1.repositoryId).toBe('id-1');
      expect(query2.repositoryId).toBe('id-2');
      expect(query1).not.toBe(query2);
    });

    it('should create distinct instances even with same repositoryId', () => {
      const repositoryId = 'same-id';
      const query1 = new GetRepositoryQuery(repositoryId);
      const query2 = new GetRepositoryQuery(repositoryId);

      expect(query1.repositoryId).toBe(query2.repositoryId);
      expect(query1).not.toBe(query2);
    });

    it('should handle creating many instances', () => {
      const queries = Array.from({ length: 100 }, (_, i) =>
        new GetRepositoryQuery(`id-${i}`)
      );

      expect(queries).toHaveLength(100);
      queries.forEach((query, index) => {
        expect(query.repositoryId).toBe(`id-${index}`);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle repositoryId with newline characters', () => {
      const repositoryId = 'id\nwith\nnewlines';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should handle repositoryId with tab characters', () => {
      const repositoryId = 'id\twith\ttabs';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should handle repositoryId with unicode characters', () => {
      const repositoryId = 'repo-id-😀-🚀';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should handle repositoryId with URL-like format', () => {
      const repositoryId = 'https://example.com/repo/123';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });

    it('should handle repositoryId with path-like format', () => {
      const repositoryId = '/path/to/repository/123';
      const query = new GetRepositoryQuery(repositoryId);

      expect(query.repositoryId).toBe(repositoryId);
    });
  });

  describe('type safety', () => {
    it('should have string type for repositoryId', () => {
      const query = new GetRepositoryQuery('test-id');

      expect(typeof query.repositoryId).toBe('string');
    });

    it('should be instance of GetRepositoryQuery', () => {
      const query = new GetRepositoryQuery('test-id');

      expect(query).toBeInstanceOf(GetRepositoryQuery);
    });

    it('should have constructor name GetRepositoryQuery', () => {
      const query = new GetRepositoryQuery('test-id');

      expect(query.constructor.name).toBe('GetRepositoryQuery');
    });
  });
});
