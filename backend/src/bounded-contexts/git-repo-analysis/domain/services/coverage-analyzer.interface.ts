import { FileCoverage } from '@/bounded-contexts/git-repo-analysis/domain/models/file-coverage.entity';

export const COVERAGE_ANALYZER = Symbol('COVERAGE_ANALYZER');

export interface ICoverageAnalyzer {
  analyze(
    workingDirectory: string,
    onOutput?: (output: string) => void,
  ): Promise<FileCoverage[]>;
}
