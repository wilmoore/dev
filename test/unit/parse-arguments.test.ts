import { describe, it, expect } from 'vitest';

// Duplicated from bin/dev.ts for unit testing
// Note: The original function is not exported from dev.ts
function parseArguments(args: string[]) {
  const parsed: {
    command: string | null;
    serverName: string | null;
    logViewer: string | null;
  } = {
    command: null,
    serverName: null,
    logViewer: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--log-viewer' && i + 1 < args.length) {
      parsed.logViewer = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (!parsed.command) {
      parsed.command = arg;
    } else if (!parsed.serverName) {
      parsed.serverName = arg;
    }
  }

  return parsed;
}

describe('parseArguments', () => {
  it('should parse command only', () => {
    const result = parseArguments(['start']);
    expect(result).toEqual({
      command: 'start',
      serverName: null,
      logViewer: null,
    });
  });

  it('should parse command and server name', () => {
    const result = parseArguments(['start', 'web']);
    expect(result).toEqual({
      command: 'start',
      serverName: 'web',
      logViewer: null,
    });
  });

  it('should parse --log-viewer flag with value', () => {
    const result = parseArguments(['start', '--log-viewer', 'bat -f']);
    expect(result).toEqual({
      command: 'start',
      serverName: null,
      logViewer: 'bat -f',
    });
  });

  it('should parse all arguments together', () => {
    const result = parseArguments(['start', 'web', '--log-viewer', 'less +F']);
    expect(result).toEqual({
      command: 'start',
      serverName: 'web',
      logViewer: 'less +F',
    });
  });

  it('should handle empty arguments', () => {
    const result = parseArguments([]);
    expect(result).toEqual({
      command: null,
      serverName: null,
      logViewer: null,
    });
  });

  it('should handle --log-viewer at the end without value', () => {
    // When --log-viewer has no value, it's treated as serverName
    // This is edge case behavior of the original implementation
    const result = parseArguments(['start', '--log-viewer']);
    expect(result).toEqual({
      command: 'start',
      serverName: '--log-viewer',
      logViewer: null,
    });
  });

  it('should handle --log-viewer before command', () => {
    const result = parseArguments(['--log-viewer', 'bat -f', 'start', 'web']);
    expect(result).toEqual({
      command: 'start',
      serverName: 'web',
      logViewer: 'bat -f',
    });
  });

  it('should handle multiple commands (only first is used)', () => {
    const result = parseArguments(['start', 'stop', 'restart']);
    expect(result).toEqual({
      command: 'start',
      serverName: 'stop',
      logViewer: null,
    });
  });
});
