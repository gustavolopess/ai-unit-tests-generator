import { Entity } from '@/shared/kernel/entity.base';

export interface FileCoverageProps {
  filePath: string;
  coveragePercentage: number;
  analyzedAt: Date;
}

export class FileCoverage extends Entity<string> {
  private props: FileCoverageProps;

  private constructor(filePath: string, props: FileCoverageProps) {
    super(filePath); // Using file path as ID
    this.props = props;
  }

  static create(filePath: string, coveragePercentage: number): FileCoverage {
    if (!filePath || filePath.trim().length === 0) {
      throw new Error('File path cannot be empty');
    }

    if (coveragePercentage < 0 || coveragePercentage > 100) {
      throw new Error('Coverage percentage must be between 0 and 100');
    }

    return new FileCoverage(filePath, {
      filePath,
      coveragePercentage,
      analyzedAt: new Date(),
    });
  }

  static reconstitute(
    filePath: string,
    props: FileCoverageProps,
  ): FileCoverage {
    return new FileCoverage(filePath, props);
  }

  get filePath(): string {
    return this.props.filePath;
  }

  get coveragePercentage(): number {
    return this.props.coveragePercentage;
  }

  get analyzedAt(): Date {
    return this.props.analyzedAt;
  }

  hasLowCoverage(threshold: number = 80): boolean {
    return this.props.coveragePercentage < threshold;
  }
}
