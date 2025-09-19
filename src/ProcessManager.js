import { spawn, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class ProcessManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.devDir = path.join(projectRoot, '.dev');
    this.pidFilePath = path.join(this.devDir, 'pid.json');
  }

  loadPidFile() {
    if (!existsSync(this.pidFilePath)) {
      return {};
    }
    return JSON.parse(readFileSync(this.pidFilePath, 'utf8'));
  }

  savePidFile(data) {
    writeFileSync(this.pidFilePath, JSON.stringify(data, null, 2));
  }

  async isProcessRunning(pid) {
    try {
      await execAsync(`ps -p ${pid}`);
      return true;
    } catch {
      return false;
    }
  }

  async findFreePort(startPort) {
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
  }

  async detectPortFromProcess(pid, fallbackPort) {
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
  }

  async startProcess(command, _serverName) {
    // Ensure log directory exists
    const logDir = path.join(this.devDir, 'log');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Start process using shell to handle redirection
    const child = spawn('sh', ['-c', command], {
      detached: true,
      stdio: 'ignore',
      cwd: this.projectRoot
    });

    child.unref();
    return child;
  }

  async stopServers(serverName = null) {
    const pidData = this.loadPidFile();
    const serversToStop = serverName ? [serverName] : Object.keys(pidData);

    for (const name of serversToStop) {
      if (!pidData[name]) {
        if (serverName) {
          console.log(`${name} is not running`);
        }
        continue;
      }

      const { pid, port } = pidData[name];
      const isRunning = await this.isProcessRunning(pid);

      if (isRunning) {
        try {
          process.kill(pid, 'SIGTERM');
          console.log(`🛑 Stopped ${name} (pid ${pid}, port ${port})`);
        } catch (error) {
          console.error(`Error stopping ${name}:`, error.message);
        }
      }

      delete pidData[name];
    }

    this.savePidFile(pidData);
  }

  async cleanup() {
    const pidData = this.loadPidFile();
    const cleanedData = {};

    for (const [name, data] of Object.entries(pidData)) {
      const isRunning = await this.isProcessRunning(data.pid);
      if (isRunning) {
        cleanedData[name] = data;
      } else {
        console.log(`Cleaned up stale entry: ${name} (pid ${data.pid})`);
      }
    }

    this.savePidFile(cleanedData);
  }
}