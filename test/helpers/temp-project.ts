import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface TempProject {
  dir: string;
  devDir: string;
  cleanup: () => Promise<void>;
}

export interface TempProjectOptions {
  packageJson?: Record<string, unknown>;
  serversConfig?: Record<string, unknown>;
  pidData?: Record<string, unknown>;
}

/**
 * Creates an isolated temporary project directory for testing
 */
export async function createTempProject(
  options: TempProjectOptions = {}
): Promise<TempProject> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-test-'));
  const devDir = path.join(dir, '.dev');

  // Create .dev directory
  await fs.mkdir(devDir, { recursive: true });
  await fs.mkdir(path.join(devDir, 'log'), { recursive: true });

  // Default package.json with a simple HTTP server script
  const packageJson = options.packageJson ?? {
    name: 'test-project',
    version: '1.0.0',
    scripts: {
      dev: "node -e \"const h=require('http');h.createServer((q,s)=>{s.end('ok')}).listen(process.env.PORT||3000,()=>console.log('Local:        http://localhost:'+(process.env.PORT||3000)))\"",
      api: "node -e \"const h=require('http');h.createServer((q,s)=>{s.end('ok')}).listen(process.env.PORT||3001,()=>console.log('Local:        http://localhost:'+(process.env.PORT||3001)))\"",
    },
  };
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Optional servers.json
  if (options.serversConfig) {
    await fs.writeFile(
      path.join(devDir, 'servers.json'),
      JSON.stringify(options.serversConfig, null, 2)
    );
  }

  // Optional pid.json
  if (options.pidData) {
    await fs.writeFile(
      path.join(devDir, 'pid.json'),
      JSON.stringify(options.pidData, null, 2)
    );
  }

  const cleanup = async () => {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  return { dir, devDir, cleanup };
}
