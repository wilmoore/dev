import { spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';

export class LogManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.devDir = path.join(projectRoot, '.dev');
  }

  async startLogViewer(serverName, logViewerCmd, serverPid) {
    const logFile = path.join(this.devDir, 'log', `${serverName}.log`);
    console.log(`\nStarting log viewer: ${logViewerCmd} ${logFile}`);
    console.log('Press Ctrl+C to stop following logs\n');

    // Check if log file exists
    if (!existsSync(logFile)) {
      console.log(`Warning: Log file ${logFile} not found. Creating empty file...`);
      writeFileSync(logFile, '');
    }

    // Parse and execute log viewer command
    const logViewerArgs = logViewerCmd.split(' ');
    const logViewerProcess = spawn(logViewerArgs[0], [...logViewerArgs.slice(1), logFile], {
      stdio: 'inherit'
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\nStopped following logs');
      logViewerProcess.kill();
      process.exit(0);
    });

    // Monitor if the server process is still running
    const monitorInterval = setInterval(async () => {
      const stillRunning = await this.isProcessRunning(serverPid);
      if (!stillRunning) {
        console.log(`\n❌ Server ${serverName} (pid ${serverPid}) has stopped`);
        clearInterval(monitorInterval);
        logViewerProcess.kill();
        // Clean up PID file
        const ProcessManager = (await import('./ProcessManager.js')).ProcessManager;
        const processManager = new ProcessManager(this.projectRoot);
        const currentPidData = processManager.loadPidFile();
        delete currentPidData[serverName];
        processManager.savePidFile(currentPidData);
        process.exit(0);
      }
    }, 5000);
  }

  async showLogs(serverName) {
    const ProcessManager = (await import('./ProcessManager.js')).ProcessManager;
    const processManager = new ProcessManager(this.projectRoot);
    const pidData = processManager.loadPidFile();

    if (!serverName) {
      const runningServers = Object.keys(pidData);
      if (runningServers.length === 0) {
        console.log('No servers running');
        return;
      }
      if (runningServers.length === 1) {
        serverName = runningServers[0];
      } else {
        console.log('Multiple servers running. Specify which one:');
        runningServers.forEach(name => console.log(`  npx dev-server-manager logs ${name}`));
        return;
      }
    }

    if (!pidData[serverName]) {
      console.log(`Server '${serverName}' is not running`);
      return;
    }

    const { pid, port } = pidData[serverName];
    const logFile = path.join(this.devDir, 'log', `${serverName}.log`);

    console.log(`Following logs for ${serverName} (pid ${pid}, port ${port})`);
    console.log(`Log file: ${logFile}`);
    console.log('Press Ctrl+C to stop following logs\n');

    // Check if log file exists
    if (!existsSync(logFile)) {
      console.log(`Log file not found. Server may have been started before logging was implemented.`);
      console.log(`Restart the server to enable logging: npx dev-server-manager stop && npx dev-server-manager start\n`);
      return;
    }

    // Use tail -f to follow the log file
    const tailProcess = spawn('tail', ['-f', logFile], {
      stdio: 'inherit'
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n\nStopped following logs');
      tailProcess.kill();
      process.exit(0);
    });

    // Monitor if the server process is still running
    const monitorInterval = setInterval(async () => {
      const stillRunning = await processManager.isProcessRunning(pid);
      if (!stillRunning) {
        console.log(`\n❌ Server ${serverName} (pid ${pid}) has stopped`);
        clearInterval(monitorInterval);
        tailProcess.kill();
        // Clean up PID file
        const currentPidData = processManager.loadPidFile();
        delete currentPidData[serverName];
        processManager.savePidFile(currentPidData);
        process.exit(0);
      }
    }, 5000);
  }

  async isProcessRunning(pid) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      await execAsync(`ps -p ${pid}`);
      return true;
    } catch {
      return false;
    }
  }
}