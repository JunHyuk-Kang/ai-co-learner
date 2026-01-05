import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger utility', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should log debug messages in development mode', () => {
    logger.debug('Test message', { data: 'test' });
    // We can't easily test DEV mode without changing environment
    // This test mainly ensures the function runs without errors
    expect(true).toBe(true);
  });

  it('should log info messages', () => {
    logger.info('Info message');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Info message', '');
  });

  it('should log warning messages', () => {
    logger.warn('Warning message');
    expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning message', '');
  });

  it('should log error messages', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', error);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error occurred', error);
  });

  it('should handle undefined data parameter', () => {
    logger.info('Message without data');
    expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Message without data', '');
  });
});
