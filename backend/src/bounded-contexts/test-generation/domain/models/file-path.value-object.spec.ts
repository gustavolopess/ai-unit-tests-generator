import { FilePath } from './file-path.value-object';

describe('FilePath Value Object', () => {
  describe('create', () => {
    it('should create a valid file path', () => {
      const filePath = FilePath.create('src/service.ts');
      expect(filePath.getValue()).toBe('src/service.ts');
    });

    it('should accept nested paths', () => {
      const filePath = FilePath.create('src/modules/user/user.service.ts');
      expect(filePath.getValue()).toBe('src/modules/user/user.service.ts');
    });

    it('should throw error for empty string', () => {
      expect(() => FilePath.create('')).toThrow('File path cannot be empty');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => FilePath.create('   ')).toThrow('File path cannot be empty');
    });

    it('should throw error for absolute path', () => {
      expect(() => FilePath.create('/etc/passwd')).toThrow(
        'Invalid file path: must be relative and safe',
      );
    });

    it('should throw error for path traversal', () => {
      expect(() => FilePath.create('../etc/passwd')).toThrow(
        'Invalid file path: must be relative and safe',
      );
      expect(() => FilePath.create('src/../../../etc/passwd')).toThrow(
        'Invalid file path: must be relative and safe',
      );
    });
  });

  describe('getValue', () => {
    it('should return the original path value', () => {
      const path = 'lib/utils/helper.ts';
      const filePath = FilePath.create(path);
      expect(filePath.getValue()).toBe(path);
    });
  });

  describe('equality', () => {
    it('should be equal when paths are the same', () => {
      const path1 = FilePath.create('src/file.ts');
      const path2 = FilePath.create('src/file.ts');

      expect(path1.equals(path2)).toBe(true);
    });

    it('should not be equal when paths are different', () => {
      const path1 = FilePath.create('src/file1.ts');
      const path2 = FilePath.create('src/file2.ts');

      expect(path1.equals(path2)).toBe(false);
    });
  });
});
