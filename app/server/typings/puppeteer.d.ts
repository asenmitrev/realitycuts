/**
 * Minimal type declaration for puppeteer-core when the package is not yet installed.
 * Install with: yarn add puppeteer-core (via workspace root).
 */
declare module 'puppeteer-core' {
  export interface LaunchOptions {
    headless?: boolean | 'shell';
    args?: string[];
  }
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export interface Page {
    setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }): Promise<void>;
    setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
    waitForFunction(
      fn: () => boolean,
      options?: { timeout?: number }
    ): Promise<unknown>;
    evaluate<T>(fn: (arg: T) => void, arg: T): Promise<void>;
    screenshot(options: { path: string; type: string }): Promise<void>;
  }
  export function launch(options?: LaunchOptions): Promise<Browser>;
  const p: { launch: typeof launch };
  export default p;
}
