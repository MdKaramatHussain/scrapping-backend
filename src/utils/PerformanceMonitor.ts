import { config } from '../config';
import logger from '../config/logger';

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();

  /**
   * Start performance measurement
   */
  static start(label: string): void {
    this.marks.set(label, Date.now());
  }

  /**
   * End performance measurement and log
   */
  static end(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      logger.warn(`No start mark found for: ${label}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.marks.delete(label);

    logger.debug(`Performance: ${label} took ${duration}ms`);
    return duration;
  }

  /**
   * Measure async operation
   */
  static async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  /**
   * Measure sync operation
   */
  static measureSync<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      const result = fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

export default PerformanceMonitor;
