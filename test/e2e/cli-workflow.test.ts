import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCLI, killProcessOnPort } from '../helpers/cli-runner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const devDir = path.join(projectRoot, '.dev');
const serversConfigPath = path.join(devDir, 'servers.json');
const pidFilePath = path.join(devDir, 'pid.json');

/**
 * E2E tests for complete CLI workflows.
 *
 * These tests backup/restore config once for the entire suite
 * to avoid test interference.
 */
describe('CLI Workflow E2E', () => {
  let originalServersConfig: string | null = null;
  let originalPidFile: string | null = null;

  // Backup once before all tests
  beforeAll(async () => {
    try {
      originalServersConfig = await fs.readFile(serversConfigPath, 'utf-8');
    } catch {
      originalServersConfig = null;
    }
    try {
      originalPidFile = await fs.readFile(pidFilePath, 'utf-8');
    } catch {
      originalPidFile = null;
    }
  });

  // Restore once after all tests
  afterAll(async () => {
    // Stop any servers
    await runCLI(['stop']).catch(() => {});
    await killProcessOnPort(3456);
    await new Promise(r => setTimeout(r, 1000));

    // Restore config
    if (originalServersConfig !== null) {
      await fs.writeFile(serversConfigPath, originalServersConfig);
    }
    if (originalPidFile !== null) {
      await fs.writeFile(pidFilePath, originalPidFile);
    } else {
      await fs.writeFile(pidFilePath, '{}');
    }
  });

  describe('help command', () => {
    it('should display usage information', async () => {
      // Ensure valid config exists
      const testConfig = {
        testapp: {
          command: 'npm run dev',
          preferredPort: 3000,
          healthCheck: 'http://localhost:{PORT}',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );

      const result = await runCLI(['help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage: npx dev');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('start');
      expect(result.stdout).toContain('stop');
      expect(result.stdout).toContain('status');
    });
  });

  describe('status command', () => {
    it('should report no servers when pid.json is empty', async () => {
      // Ensure valid config exists
      const testConfig = {
        testapp: {
          command: 'npm run dev',
          preferredPort: 3000,
          healthCheck: 'http://localhost:{PORT}',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['status']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No servers running');
    });
  });

  describe('doctor command', () => {
    it('should show configuration', async () => {
      // Ensure we have valid config
      const testConfig = {
        testapp: {
          command: 'npm run dev',
          preferredPort: 3000,
          healthCheck: 'http://localhost:{PORT}',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );

      const result = await runCLI(['doctor']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration:');
    });
  });

  describe('cleanup command', () => {
    it('should complete without error when pid.json is empty', async () => {
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['cleanup']);

      expect(result.exitCode).toBe(0);
    });

    it('should remove stale pid entries', async () => {
      // First ensure valid config
      const testConfig = {
        staleserver: {
          command: 'npm run dev',
          preferredPort: 3456,
          healthCheck: 'http://localhost:3456',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );

      // Create a pid entry with a non-existent process
      const stalePidData = {
        staleserver: {
          pid: 999999, // Very unlikely to exist
          port: 3456,
          startTime: new Date().toISOString(),
          status: 'healthy',
        },
      };
      await fs.writeFile(pidFilePath, JSON.stringify(stalePidData, null, 2));

      // Run cleanup
      const result = await runCLI(['cleanup']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Cleaned up stale entry: staleserver');

      // Verify pid.json is now empty
      const pidContent = await fs.readFile(pidFilePath, 'utf-8');
      expect(JSON.parse(pidContent)).toEqual({});
    });
  });
});
