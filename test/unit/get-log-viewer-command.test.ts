import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Duplicated from bin/dev.ts for unit testing
// Note: The original function is not exported from dev.ts
function getLogViewerCommand(cliLogViewer: string | null): string {
  return cliLogViewer || process.env.DEV_LOG_VIEWER || 'tail -f';
}

describe('getLogViewerCommand', () => {
  const originalEnv = process.env.DEV_LOG_VIEWER;

  beforeEach(() => {
    delete process.env.DEV_LOG_VIEWER;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.DEV_LOG_VIEWER = originalEnv;
    } else {
      delete process.env.DEV_LOG_VIEWER;
    }
  });

  it('should prioritize CLI argument over env var', () => {
    process.env.DEV_LOG_VIEWER = 'env-viewer';
    expect(getLogViewerCommand('cli-viewer')).toBe('cli-viewer');
  });

  it('should use env var when no CLI argument', () => {
    process.env.DEV_LOG_VIEWER = 'bat -f';
    expect(getLogViewerCommand(null)).toBe('bat -f');
  });

  it('should default to tail -f when neither CLI nor env set', () => {
    expect(getLogViewerCommand(null)).toBe('tail -f');
  });

  it('should handle empty string CLI argument as falsy', () => {
    process.env.DEV_LOG_VIEWER = 'env-viewer';
    // Empty string is falsy, should fall through to env
    expect(getLogViewerCommand('')).toBe('env-viewer');
  });

  it('should handle whitespace-only env var', () => {
    process.env.DEV_LOG_VIEWER = '   ';
    // Whitespace is truthy, so it will be used
    expect(getLogViewerCommand(null)).toBe('   ');
  });

  it('should use complex command from CLI', () => {
    expect(getLogViewerCommand('less +F -R')).toBe('less +F -R');
  });

  it('should use complex command from env', () => {
    process.env.DEV_LOG_VIEWER = 'bat --paging=always -f';
    expect(getLogViewerCommand(null)).toBe('bat --paging=always -f');
  });
});
