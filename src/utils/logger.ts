/**
 * Structured logging utility for AI Co-Learner
 *
 * Usage:
 * - logger.debug: Development-only logs (removed in production)
 * - logger.info: General information logs
 * - logger.warn: Warning messages
 * - logger.error: Error messages (can be sent to monitoring service)
 */

export const logger = {
  /**
   * Debug logs - only shown in development mode
   * @param msg - Log message
   * @param data - Optional data to log
   */
  debug: (msg: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${msg}`, data !== undefined ? data : '');
    }
  },

  /**
   * Info logs - shown in all environments
   * @param msg - Log message
   * @param data - Optional data to log
   */
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${msg}`, data !== undefined ? data : '');
  },

  /**
   * Warning logs - shown in all environments
   * @param msg - Log message
   * @param data - Optional data to log
   */
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${msg}`, data !== undefined ? data : '');
  },

  /**
   * Error logs - shown in all environments
   * Can be extended to send to monitoring services like Sentry
   * @param msg - Error message
   * @param error - Error object or additional data
   */
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`, error !== undefined ? error : '');
    // TODO: Send to monitoring service in production (e.g., Sentry)
    // if (import.meta.env.PROD) {
    //   sentryService.captureException(error, { message: msg });
    // }
  },
};
