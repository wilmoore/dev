import { describe, it, expect } from 'vitest';

// Duplicated from bin/dev.ts for unit testing
// Note: The original function is not exported from dev.ts
function sanitizeServerName(serverName: string): string {
  return serverName.replace(/[^a-zA-Z0-9-_]/g, '-');
}

describe('sanitizeServerName', () => {
  it('should pass through valid names unchanged', () => {
    expect(sanitizeServerName('web-server')).toBe('web-server');
    expect(sanitizeServerName('api_v2')).toBe('api_v2');
    expect(sanitizeServerName('Server123')).toBe('Server123');
  });

  it('should replace spaces with hyphens', () => {
    expect(sanitizeServerName('my server')).toBe('my-server');
    expect(sanitizeServerName('web app')).toBe('web-app');
  });

  it('should replace special characters with hyphens', () => {
    expect(sanitizeServerName('server@2.0')).toBe('server-2-0');
    expect(sanitizeServerName('web/api')).toBe('web-api');
    expect(sanitizeServerName('test:server')).toBe('test-server');
  });

  it('should handle empty string', () => {
    expect(sanitizeServerName('')).toBe('');
  });

  it('should handle strings with only special characters', () => {
    expect(sanitizeServerName('@#$%')).toBe('----');
  });

  it('should preserve underscores and hyphens', () => {
    expect(sanitizeServerName('my_server-name')).toBe('my_server-name');
  });

  it('should handle mixed alphanumeric and special characters', () => {
    expect(sanitizeServerName('server.v1.0-beta')).toBe('server-v1-0-beta');
  });
});
