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
 * E2E tests for individual CLI commands.
 */
describe('CLI Commands', () => {
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
    await killProcessOnPort(3458);
    await killProcessOnPort(3459);
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

  describe('unknown command', () => {
    it('should show help for unknown commands', async () => {
      // Ensure valid config first
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['unknowncommand']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command or server');
      expect(result.stdout).toContain('Usage: npx dev');
    });
  });

  describe('start command', () => {
    it('should error for non-existent server name', async () => {
      const testConfig = {
        realserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['start', 'nonexistent']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown server: nonexistent');
    });
  });

  describe('restart command', () => {
    it('should require server name', async () => {
      // Ensure valid config
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['restart']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Server name required for restart');
    });
  });

  describe('logs command', () => {
    it('should report when server is not running', async () => {
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['logs', 'testserver']);

      // Logs command checks if server is in pid.json
      expect(result.stdout).toContain("Server 'testserver' is not running");
    });

    it('should report when no servers running and no name specified', async () => {
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['logs']);

      expect(result.stdout).toContain('No servers running');
    });
  });

  describe('stop command', () => {
    it('should handle stopping when no servers running', async () => {
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['stop']);

      // Should succeed with no servers to stop
      expect(result.exitCode).toBe(0);
    });

    it('should handle stopping specific non-running server', async () => {
      const testConfig = {
        testserver: {
          command: 'npm run dev',
          preferredPort: 3458,
          healthCheck: 'http://localhost:3458',
        },
      };
      await fs.writeFile(
        serversConfigPath,
        JSON.stringify(testConfig, null, 2)
      );
      await fs.writeFile(pidFilePath, '{}');

      const result = await runCLI(['stop', 'testserver']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('testserver is not running');
    });
  });
});
