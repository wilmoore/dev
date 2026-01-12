import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

// Get the path to the CLI script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../../bin/dev.ts');

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CLIOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

/**
 * Run the dev CLI with given arguments
 */
export async function runCLI(
  args: string[],
  options: CLIOptions = {}
): Promise<CLIResult> {
  const { cwd = process.cwd(), timeout = 30000, env = {} } = options;

  return new Promise(resolve => {
    const proc = spawn('npx', ['tsx', CLI_PATH, ...args], {
      cwd,
      env: {
        ...process.env,
        ENABLE_NOTIFICATIONS: 'false',
        ...env,
      },
      timeout,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on('error', err => {
      resolve({
        stdout,
        stderr: stderr + err.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Kill any process on a specific port
 */
export async function killProcessOnPort(port: number): Promise<void> {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid), 'SIGKILL');
      } catch {
        // Process already dead
      }
    }
  } catch {
    // No process on port
  }
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 10000,
  interval = 100
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}
