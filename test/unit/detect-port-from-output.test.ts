import { describe, it, expect } from 'vitest';

// Duplicated from bin/dev.ts for unit testing
// Note: The original function is not exported from dev.ts
function detectPortFromOutput(output: string): number | null {
  const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
  return match ? parseInt(match[1]) : null;
}

describe('detectPortFromOutput', () => {
  it('should detect port from Next.js output format', () => {
    const output = `
   ▲ Next.js 14.0.0
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.100:3000
    `;
    expect(detectPortFromOutput(output)).toBe(3000);
  });

  it('should detect port from simple format', () => {
    const output = '- Local:        http://localhost:8080';
    expect(detectPortFromOutput(output)).toBe(8080);
  });

  it('should detect port with varying whitespace', () => {
    const output = 'Local:  http://localhost:4000';
    expect(detectPortFromOutput(output)).toBe(4000);
  });

  it('should detect high port numbers', () => {
    const output = 'Local:        http://localhost:65535';
    expect(detectPortFromOutput(output)).toBe(65535);
  });

  it('should return null for output without port', () => {
    expect(detectPortFromOutput('Server starting...')).toBe(null);
    expect(detectPortFromOutput('')).toBe(null);
  });

  it('should detect port from Vite-like output format', () => {
    // Vite uses a slightly different format but the regex is flexible
    const viteOutput = `
  VITE v5.0.0  ready in 200 ms

  ➜  Local:   http://localhost:5173/
    `;
    // The regex is flexible enough to match this format
    expect(detectPortFromOutput(viteOutput)).toBe(5173);
  });

  it('should not match non-localhost URLs', () => {
    const output = 'Local:        http://127.0.0.1:3000';
    expect(detectPortFromOutput(output)).toBe(null);
  });

  it('should return first match when multiple ports present', () => {
    const output = `
   - Local:        http://localhost:3000
   - Local:        http://localhost:3001
    `;
    expect(detectPortFromOutput(output)).toBe(3000);
  });
});
