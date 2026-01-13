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
 * E2E tests for error handling and edge cases.
 */
describe('Error Handling', () => {
  let originalServersConfig: string | null = null;
  let originalPidFile: string | null = null;

  beforeAll(async () => {
    // Ensure .dev directory exists (may not exist in CI)
    await fs.mkdir(devDir, { recursive: true });

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

  afterAll(async () => {
    await runCLI(['stop']).catch(() => {});
    await killProcessOnPort(3460);
    await new Promise(r => setTimeout(r, 1000));

    if (originalServersConfig !== null) {
      await fs.writeFile(serversConfigPath, originalServersConfig);
    }
    if (originalPidFile !== null) {
      await fs.writeFile(pidFilePath, originalPidFile);
    } else {
      await fs.writeFile(pidFilePath, '{}');
    }
  });

  describe('configuration errors', () => {
    it('should handle empty servers.json object', async () => {
      await fs.writeFile(serversConfigPath, '{}');
      await fs.writeFile(pidFilePath, '{}');

      // Start with no servers configured
      const result = await runCLI(['start']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('No servers configured');
    });

    it('should suggest npx dev init when servers.json missing', async () => {
      // Temporarily rename servers.json
      const backupPath = serversConfigPath + '.bak';
      await fs.rename(serversConfigPath, backupPath);

      try {
        const result = await runCLI(['status']);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('npx dev init');
      } finally {
        // Restore servers.json
        await fs.rename(backupPath, serversConfigPath);
      }
    });
  });

  describe('process cleanup', () => {
    it('should clean up stale pid entries on status', async () => {
      const testConfig = {
        staleserver: {
          command: 'npm run dev',
          preferredPort: 3460,
          healthCheck: 'http://localhost:3460',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );

      // Create stale pid entry with non-existent process
      const stalePidData = {
        staleserver: {
          pid: 999998,
          port: 3460,
          startTime: new Date().toISOString(),
          status: 'healthy',
        },
      };
      await fs.writeFile(pidFilePath, JSON.stringify(stalePidData, null, 2));

      // Status should detect dead process and clean up
      const result = await runCLI(['status']);

      // The output should indicate the server is dead
      expect(result.stdout).toMatch(/DEAD|cleaning up/i);
    });
  });

  describe('help variants', () => {
    it('should show help with help command', async () => {
      // Ensure valid config first
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3460,
          healthCheck: 'http://localhost:3460',
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
    });
  });
});
