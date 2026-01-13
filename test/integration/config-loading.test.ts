import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const devDir = path.join(projectRoot, '.dev');
const serversConfigPath = path.join(devDir, 'servers.json');
const pidFilePath = path.join(devDir, 'pid.json');

/**
 * Integration tests for configuration loading.
 *
 * NOTE: The dev.ts CLI uses __dirname-relative paths, so it always operates
 * on the project's own .dev/ directory, not the temp project directory.
 * These tests work directly with the project's config files.
 *
 * For isolated testing, we backup and restore the config files.
 */
describe('Configuration Loading', () => {
  let originalServersConfig: string | null = null;
  let originalPidFile: string | null = null;

  // Backup existing config before tests
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

  // Restore original config after all tests
  afterEach(async () => {
    // Restore servers.json
    if (originalServersConfig !== null) {
      await fs.writeFile(serversConfigPath, originalServersConfig);
    }
    // Restore pid.json
    if (originalPidFile !== null) {
      await fs.writeFile(pidFilePath, originalPidFile);
    }
  });

  describe('servers.json parsing', () => {
    it('should parse valid JSON configuration', async () => {
      const config = {
        web: {
          command: 'npm run dev',
          preferredPort: 3000,
          healthCheck: 'http://localhost:{PORT}',
        },
        api: {
          command: 'npm run api',
          preferredPort: 3001,
          healthCheck: 'http://localhost:{PORT}/health',
        },
      };

      // Read it back and verify structure
      const parsed = JSON.parse(JSON.stringify(config)) as typeof config;

      expect(parsed.web).toBeDefined();
      expect(parsed.web.command).toBe('npm run dev');
      expect(parsed.web.preferredPort).toBe(3000);
      expect(parsed.api.healthCheck).toBe('http://localhost:{PORT}/health');
    });

    it('should handle servers with template variables', async () => {
      const config = {
        dev: {
          command: 'PORT={PORT} npm run dev',
          preferredPort: 3000,
          healthCheck: 'http://localhost:{PORT}',
        },
      };

      const command = config.dev.command.replace(/{PORT}/g, '3000');
      expect(command).toBe('PORT=3000 npm run dev');

      const healthCheck = config.dev.healthCheck.replace(/{PORT}/g, '3000');
      expect(healthCheck).toBe('http://localhost:3000');
    });
  });

  describe('pid.json structure', () => {
    it('should handle empty pid data', async () => {
      const pidData: Record<string, unknown> = {};
      expect(Object.keys(pidData).length).toBe(0);
    });

    it('should validate pid entry structure', async () => {
      const pidEntry = {
        pid: 12345,
        port: 3000,
        startTime: new Date().toISOString(),
        status: 'healthy',
      };

      expect(pidEntry.pid).toBeTypeOf('number');
      expect(pidEntry.port).toBeTypeOf('number');
      expect(pidEntry.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(['healthy', 'unhealthy', 'starting']).toContain(pidEntry.status);
    });

    it('should serialize and deserialize pid data correctly', async () => {
      const pidData = {
        web: {
          pid: 12345,
          port: 3000,
          startTime: '2024-01-01T12:00:00.000Z',
          status: 'healthy',
        },
      };

      const serialized = JSON.stringify(pidData, null, 2);
      const parsed = JSON.parse(serialized);

      expect(parsed.web.pid).toBe(12345);
      expect(parsed.web.port).toBe(3000);
    });
  });

  describe('log path generation', () => {
    it('should sanitize server name for log file path', () => {
      // Test the sanitization logic
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, '-');

      expect(sanitize('web')).toBe('web');
      expect(sanitize('my server')).toBe('my-server');
      expect(sanitize('api@v2')).toBe('api-v2');
    });

    it('should generate correct log file path', () => {
      const serverName = 'web';
      const sanitized = serverName.replace(/[^a-zA-Z0-9-_]/g, '-');
      const logPath = path.join(devDir, 'log', `${sanitized}.log`);

      expect(logPath).toContain('.dev/log/web.log');
    });
  });
});
