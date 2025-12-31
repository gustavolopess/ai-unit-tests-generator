export const NPM_SERVICE = Symbol('NPM_SERVICE');

export interface INpmService {
  /**
   * Installs npm dependencies in the specified working directory
   * @param workingDir - The directory where npm install should be executed
   * @param timeout - Optional timeout in milliseconds (default: 5 minutes)
   */
  install(
    workingDir: string,
    timeout?: number,
  ): Promise<{ stdout: string; stderr: string }>;
}
