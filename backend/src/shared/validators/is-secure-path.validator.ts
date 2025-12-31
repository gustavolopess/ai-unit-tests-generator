import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator to prevent path traversal attacks
 * Rejects paths containing:
 * - ".." (parent directory traversal)
 * - Absolute paths (starting with "/" or drive letters like "C:")
 * - Dangerous shell characters
 */
@ValidatorConstraint({ async: false })
export class IsSecurePathConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null) {
      return true; // Let @IsOptional() handle null/undefined
    }

    if (typeof value !== 'string') {
      return false;
    }

    const trimmed = value.trim();

    // Reject empty strings
    if (!trimmed) {
      return false;
    }

    // Check for path traversal attempts
    if (trimmed.includes('..')) {
      return false;
    }

    // Check for absolute paths (Unix or Windows)
    if (trimmed.startsWith('/') || /^[a-zA-Z]:/.test(trimmed)) {
      return false;
    }

    // Check for dangerous shell characters that could enable command injection
    const dangerousChars = /[`$();|&<>\\'"]/;
    if (dangerousChars.test(trimmed)) {
      return false;
    }

    // Check for null bytes (used in some path traversal attacks)
    if (trimmed.includes('\0')) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid relative path without traversal sequences (..), absolute paths, or special characters`;
  }
}

/**
 * Decorator to validate that a path is secure and doesn't allow traversal
 */
export function IsSecurePath(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSecurePathConstraint,
    });
  };
}
