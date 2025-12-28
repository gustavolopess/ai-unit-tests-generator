export const TEST_GENERATOR = Symbol('TEST_GENERATOR');

export interface TestGenerationResult {
  sessionId: string;
  testFilePath?: string;
  coverage?: number;
}

export interface ITestGenerator {
  generateTests(
    workingDirectory: string,
    targetFilePath: string,
    onOutput?: (output: string) => void,
  ): Promise<TestGenerationResult>;
}
