import { FileCoverage } from '../models/file-coverage.entity';

export const COVERAGE_ANALYZER = Symbol('COVERAGE_ANALYZER');

export interface ICoverageAnalyzer {
  analyze(
    workingDirectory: string,
    onOutput?: (output: string) => void,
  ): Promise<FileCoverage[]>;
}
