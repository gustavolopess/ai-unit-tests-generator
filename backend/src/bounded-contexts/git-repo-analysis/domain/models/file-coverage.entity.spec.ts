import { FileCoverage } from './file-coverage.entity';

describe('FileCoverage Entity', () => {
  describe('create', () => {
    it('should create a file coverage with valid inputs', () => {
      const fileCoverage = FileCoverage.create('src/service.ts', 85);

      expect(fileCoverage.filePath).toBe('src/service.ts');
      expect(fileCoverage.coveragePercentage).toBe(85);
      expect(fileCoverage.analyzedAt).toBeInstanceOf(Date);
    });

    it('should use filePath as ID', () => {
      const fileCoverage = FileCoverage.create('src/service.ts', 80);
      expect(fileCoverage.id).toBe('src/service.ts');
    });

    it('should throw error for empty file path', () => {
      expect(() => FileCoverage.create('', 80)).toThrow(
        'File path cannot be empty',
      );
    });

    it('should throw error for whitespace-only file path', () => {
      expect(() => FileCoverage.create('   ', 80)).toThrow(
        'File path cannot be empty',
      );
    });

    it('should throw error for coverage below 0', () => {
      expect(() => FileCoverage.create('src/file.ts', -1)).toThrow(
        'Coverage percentage must be between 0 and 100',
      );
    });

    it('should throw error for coverage above 100', () => {
      expect(() => FileCoverage.create('src/file.ts', 101)).toThrow(
        'Coverage percentage must be between 0 and 100',
      );
    });

    it('should accept coverage of exactly 0', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 0);
      expect(fileCoverage.coveragePercentage).toBe(0);
    });

    it('should accept coverage of exactly 100', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 100);
      expect(fileCoverage.coveragePercentage).toBe(100);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props without validation', () => {
      const props = {
        filePath: 'src/file.ts',
        coveragePercentage: 75,
        analyzedAt: new Date('2024-01-01'),
      };

      const fileCoverage = FileCoverage.reconstitute('src/file.ts', props);

      expect(fileCoverage.filePath).toBe('src/file.ts');
      expect(fileCoverage.coveragePercentage).toBe(75);
      expect(fileCoverage.analyzedAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('hasLowCoverage', () => {
    it('should return true if coverage is below default threshold (80)', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 79);
      expect(fileCoverage.hasLowCoverage()).toBe(true);
    });

    it('should return false if coverage is at default threshold (80)', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 80);
      expect(fileCoverage.hasLowCoverage()).toBe(false);
    });

    it('should return false if coverage is above default threshold', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 81);
      expect(fileCoverage.hasLowCoverage()).toBe(false);
    });

    it('should use custom threshold when provided', () => {
      const fileCoverage = FileCoverage.create('src/file.ts', 89);

      expect(fileCoverage.hasLowCoverage(90)).toBe(true);
      expect(fileCoverage.hasLowCoverage(89)).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return correct values', () => {
      const fileCoverage = FileCoverage.create('src/test.ts', 95);

      expect(fileCoverage.filePath).toBe('src/test.ts');
      expect(fileCoverage.coveragePercentage).toBe(95);
      expect(fileCoverage.analyzedAt).toBeInstanceOf(Date);
    });
  });
});
