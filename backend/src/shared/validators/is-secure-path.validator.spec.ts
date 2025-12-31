import { IsSecurePathConstraint } from './is-secure-path.validator';

describe('IsSecurePathConstraint', () => {
  let validator: IsSecurePathConstraint;

  beforeEach(() => {
    validator = new IsSecurePathConstraint();
  });

  describe('valid paths', () => {
    it('should accept simple relative paths', () => {
      expect(validator.validate('src/file.ts', {} as any)).toBe(true);
      expect(validator.validate('packages/api', {} as any)).toBe(true);
      expect(validator.validate('lib/utils/helper.ts', {} as any)).toBe(true);
    });

    it('should accept paths with dots in filenames', () => {
      expect(validator.validate('src/file.spec.ts', {} as any)).toBe(true);
      expect(validator.validate('config/.eslintrc.js', {} as any)).toBe(true);
    });

    it('should accept paths with hyphens and underscores', () => {
      expect(validator.validate('my-package/my_file.ts', {} as any)).toBe(true);
      expect(validator.validate('src/user-service.ts', {} as any)).toBe(true);
    });

    it('should accept undefined and null (let @IsOptional handle these)', () => {
      expect(validator.validate(undefined, {} as any)).toBe(true);
      expect(validator.validate(null, {} as any)).toBe(true);
    });

    it('should accept nested paths', () => {
      expect(validator.validate('a/b/c/d/e/f.ts', {} as any)).toBe(true);
    });
  });

  describe('path traversal attacks', () => {
    it('should reject paths with ".." traversal', () => {
      expect(validator.validate('../etc/passwd', {} as any)).toBe(false);
      expect(validator.validate('src/../../../etc/passwd', {} as any)).toBe(
        false,
      );
      expect(validator.validate('..', {} as any)).toBe(false);
      expect(validator.validate('foo/../bar', {} as any)).toBe(false);
    });

    it('should reject paths with encoded traversal attempts', () => {
      // Note: this tests the raw string, URL encoding would need separate handling
      expect(validator.validate('src/..', {} as any)).toBe(false);
    });
  });

  describe('absolute paths', () => {
    it('should reject Unix absolute paths', () => {
      expect(validator.validate('/etc/passwd', {} as any)).toBe(false);
      expect(validator.validate('/usr/local/bin', {} as any)).toBe(false);
      expect(validator.validate('/', {} as any)).toBe(false);
    });

    it('should reject Windows absolute paths', () => {
      expect(validator.validate('C:\\Windows\\System32', {} as any)).toBe(
        false,
      );
      expect(validator.validate('D:\\folder\\file.txt', {} as any)).toBe(false);
      expect(validator.validate('c:/folder/file.txt', {} as any)).toBe(false);
    });
  });

  describe('shell injection characters', () => {
    it('should reject paths with backticks', () => {
      expect(validator.validate('file`whoami`.ts', {} as any)).toBe(false);
    });

    it('should reject paths with dollar signs', () => {
      expect(validator.validate('file$HOME.ts', {} as any)).toBe(false);
      expect(validator.validate('${HOME}/file.ts', {} as any)).toBe(false);
    });

    it('should reject paths with semicolons', () => {
      expect(validator.validate('file.ts; rm -rf /', {} as any)).toBe(false);
    });

    it('should reject paths with pipes', () => {
      expect(validator.validate('file.ts | cat /etc/passwd', {} as any)).toBe(
        false,
      );
    });

    it('should reject paths with ampersands', () => {
      expect(validator.validate('file.ts && rm -rf /', {} as any)).toBe(false);
    });

    it('should reject paths with angle brackets', () => {
      expect(validator.validate('file.ts > /tmp/out', {} as any)).toBe(false);
      expect(validator.validate('file.ts < /tmp/in', {} as any)).toBe(false);
    });

    it('should reject paths with parentheses', () => {
      expect(validator.validate('file(test).ts', {} as any)).toBe(false);
    });

    it('should reject paths with quotes', () => {
      expect(validator.validate("file'test.ts", {} as any)).toBe(false);
      expect(validator.validate('file"test.ts', {} as any)).toBe(false);
    });

    it('should reject paths with backslashes', () => {
      expect(validator.validate('file\\test.ts', {} as any)).toBe(false);
    });
  });

  describe('null bytes', () => {
    it('should reject paths with null bytes', () => {
      expect(validator.validate('file.ts\0.jpg', {} as any)).toBe(false);
      expect(validator.validate('src\0/../etc/passwd', {} as any)).toBe(false);
    });
  });

  describe('empty and invalid inputs', () => {
    it('should reject empty strings', () => {
      expect(validator.validate('', {} as any)).toBe(false);
    });

    it('should reject whitespace-only strings', () => {
      expect(validator.validate('   ', {} as any)).toBe(false);
      expect(validator.validate('\t\n', {} as any)).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validator.validate(123, {} as any)).toBe(false);
      expect(validator.validate({}, {} as any)).toBe(false);
      expect(validator.validate([], {} as any)).toBe(false);
    });
  });

  describe('defaultMessage', () => {
    it('should return a descriptive error message', () => {
      const args = { property: 'targetFilePath' } as any;
      const message = validator.defaultMessage(args);
      expect(message).toContain('targetFilePath');
      expect(message).toContain('relative path');
    });
  });
});
