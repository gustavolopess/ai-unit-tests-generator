import { JobId } from './job-id.value-object';

describe('JobId Value Object', () => {
  describe('create', () => {
    it('should create a JobId from a valid string', () => {
      const value = '550e8400-e29b-41d4-a716-446655440000';
      const jobId = JobId.create(value);
      expect(jobId.getValue()).toBe(value);
    });

    it('should throw error for empty string', () => {
      expect(() => JobId.create('')).toThrow('JobId cannot be empty');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => JobId.create('   ')).toThrow('JobId cannot be empty');
    });
  });

  describe('generate', () => {
    it('should generate a unique JobId', () => {
      const id1 = JobId.generate();
      const id2 = JobId.generate();

      expect(id1.getValue()).not.toBe(id2.getValue());
    });

    it('should generate a valid UUID format', () => {
      const jobId = JobId.generate();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(jobId.getValue())).toBe(true);
    });
  });

  describe('getValue', () => {
    it('should return the ID value', () => {
      const value = 'test-id-123';
      const jobId = JobId.create(value);
      expect(jobId.getValue()).toBe(value);
    });
  });

  describe('toString', () => {
    it('should return the ID as string', () => {
      const value = 'test-id-456';
      const jobId = JobId.create(value);
      expect(jobId.toString()).toBe(value);
    });
  });

  describe('equality', () => {
    it('should be equal when values are the same', () => {
      const id1 = JobId.create('same-id');
      const id2 = JobId.create('same-id');

      expect(id1.equals(id2)).toBe(true);
    });

    it('should not be equal when values are different', () => {
      const id1 = JobId.create('id-1');
      const id2 = JobId.create('id-2');

      expect(id1.equals(id2)).toBe(false);
    });
  });
});
