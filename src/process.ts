import { spawn, exec, ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface PidData {
  [key: string]: {
    pid: number;
    port: number;
    startTime: string;
    status: string;
  };
}

const getDevDir = (projectRoot: string) => path.join(projectRoot, '.dev');
const getPidFilePath = (projectRoot: string) => path.join(getDevDir(projectRoot), 'pid.json');

export const loadPidFile = (projectRoot: string): PidData => {
  const pidFilePath = getPidFilePath(projectRoot);
  if (!existsSync(pidFilePath)) {
    return {};
  }
  return JSON.parse(readFileSync(pidFilePath, 'utf8'));
};

export const savePidFile = (projectRoot: string, data: PidData): void => {
  const pidFilePath = getPidFilePath(projectRoot);
  writeFileSync(pidFilePath, JSON.stringify(data, null, 2));
};

export const isProcessRunning = async (pid: number): Promise<boolean> => {
  try {
    await execAsync(`ps -p ${pid}`);
    return true;
  } catch {
    return false;
  }
};

export const findFreePort = async (startPort: number): Promise<number> => {
  let port = startPort;
  while (port < startPort + 100) {
    try {
      await execAsync(`lsof -i :${port}`);
      port++;
    } catch {
      return port; // Port is free
    }
  }
  throw new Error(`No free port found starting from ${startPort}`);
};

export const detectPortFromProcess = async (pid: number, fallbackPort: number): Promise<number> => {
  try {
    const { stdout } = await execAsync(`lsof -i -P -n | grep ${pid} | grep LISTEN`);
    const portMatch = stdout.match(/:(\d+)\s+\(LISTEN\)/);
    if (portMatch) {
      const detectedPort = parseInt(portMatch[1]);
      console.log(`Detected server running on port ${detectedPort}`);
      return detectedPort;
    }
  } catch (_e) {
    console.log(`Using configured port ${fallbackPort} (could not detect from process)`);
  }
  return fallbackPort;
};

export const startProcess = async (projectRoot: string, command: string, _serverName: string): Promise<ChildProcess> => {
  const devDir = getDevDir(projectRoot);
  // Ensure log directory exists
  const logDir = path.join(devDir, 'log');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Start process using shell to handle redirection
  const child = spawn('sh', ['-c', command], {
    detached: true,
    stdio: 'ignore',
    cwd: projectRoot
  });

  child.unref();
  return child;
};

export const stopServers = async (projectRoot: string, serverName: string | null = null): Promise<void> => {
  const pidData = loadPidFile(projectRoot);
  const serversToStop = serverName ? [serverName] : Object.keys(pidData);

  for (const name of serversToStop) {
    if (!pidData[name]) {
      if (serverName) {
        console.log(`${name} is not running`);
      }
      continue;
    }

    const { pid, port } = pidData[name];
    const isRunning = await isProcessRunning(pid);

    if (isRunning) {
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`🛑 Stopped ${name} (pid ${pid}, port ${port})`);
      } catch (error) {
        console.error(`Error stopping ${name}:`, (error as Error).message);
      }
    }

    delete pidData[name];
  }

  savePidFile(projectRoot, pidData);
};

export const cleanup = async (projectRoot: string): Promise<void> => {
  const pidData = loadPidFile(projectRoot);
  const cleanedData: PidData = {};

  for (const [name, data] of Object.entries(pidData)) {
    const isRunning = await isProcessRunning(data.pid);
    if (isRunning) {
      cleanedData[name] = data;
    } else {
      console.log(`Cleaned up stale entry: ${name} (pid ${data.pid})`);
    }
  }

  savePidFile(projectRoot, cleanedData);
};