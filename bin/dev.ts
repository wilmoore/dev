#!/usr/bin/env tsx

import { spawn, exec, ChildProcess } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'fs';
import { networkInterfaces } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
} from './notify.js';

const execAsync = promisify(exec);

// Get primary network IP address
function getNetworkIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal (localhost) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

interface ServerConfig {
  command: string;
  preferredPort: number;
  healthCheck: string;
}

interface ServersConfig {
  [serverName: string]: ServerConfig;
}

interface PidData {
  [serverName: string]: {
    pid: number;
    port: number;
    startTime: string;
    status: string;
  };
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const devDir = path.join(projectRoot, '.dev');
const serversConfigPath = path.join(devDir, 'servers.json');
const pidFilePath = path.join(devDir, 'pid.json');

// Ensure .dev directory exists
if (!existsSync(devDir)) {
  mkdirSync(devDir, { recursive: true });
}

// Load configuration
function loadServersConfig(): ServersConfig {
  if (!existsSync(serversConfigPath)) {
    console.error('Error: .dev/servers.json not found');
    console.error('Run: npx dev init');
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(serversConfigPath, 'utf8')) as ServersConfig;
  } catch (error) {
    console.error(`Error: Failed to parse ${serversConfigPath}`);
    console.error((error as Error).message);
    process.exit(1);
  }
}

// Load/save PID file
function loadPidFile(): PidData {
  if (!existsSync(pidFilePath)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(pidFilePath, 'utf8')) as PidData;
  } catch (error) {
    console.warn(`Warning: Failed to parse ${pidFilePath}, using empty state`);
    console.warn((error as Error).message);
    return {};
  }
}

function savePidFile(data: PidData): void {
  writeFileSync(pidFilePath, JSON.stringify(data, null, 2));
}

// Sanitize server name for use in filenames
function sanitizeServerName(serverName: string): string {
  return serverName.replace(/[^a-zA-Z0-9-_]/g, '-');
}

// Get log file path for a server
function getLogFilePath(serverName: string): string {
  const sanitized = sanitizeServerName(serverName);
  return path.join(devDir, 'log', `${sanitized}.log`);
}

// Check if process is running
async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    await execAsync(`ps -p ${pid}`);
    return true;
  } catch {
    return false;
  }
}

// Find free port starting from preferred port
async function findFreePort(startPort: number): Promise<number> {
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

// Health check with exponential backoff
async function healthCheck(
  url: string,
  timeout = 10000,
  maxRetries = 3
): Promise<boolean> {
  const delays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const success = await new Promise<boolean>(resolve => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      fetch(url, { signal: controller.signal })
        .then(() => {
          clearTimeout(timeoutId);
          resolve(true);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          resolve(false);
        });
    });

    if (success) {
      return true;
    }

    // Wait before retry (except on last attempt)
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  return false;
}

// Detect actual port from process output
function detectPortFromOutput(output: string): number | null {
  const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Kill process using a specific port
async function killProcessOnPort(port: number) {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout
      .trim()
      .split('\n')
      .filter(p => p);

    if (pids.length > 0) {
      console.log(`🔧 Killing process(es) on port ${port}: ${pids.join(', ')}`);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait for graceful shutdown
        } catch (e) {
          // Process might already be dead
        }
      }
      // Wait a bit more for port to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (e) {
    // No process on port, that's fine
  }
}

// Start server
async function startServer(
  serverName: string,
  logViewerCmd: string | null = null
) {
  const servers = loadServersConfig();
  const server = servers[serverName];

  if (!server) {
    console.error(
      `Error: Server '${serverName}' not found in .dev/servers.json`
    );
    process.exit(1);
  }

  const pidData = loadPidFile();

  // Check if already running
  if (pidData[serverName]) {
    const isRunning = await isProcessRunning(pidData[serverName].pid);
    if (isRunning) {
      console.log(
        `${serverName} is already running on port ${pidData[serverName].port} (pid ${pidData[serverName].pid})`
      );
      console.log(`Use 'npx dev ${serverName} restart' to restart it`);
      return;
    } else {
      // Clean up stale entry
      delete pidData[serverName];
      savePidFile(pidData);
    }
  }

  try {
    // For Vite, let it choose its own port, for others use our port management
    const preferredPort = server.preferredPort;
    let actualPort: number, command: string;

    if (server.command.includes('{PORT}')) {
      // Port-managed server
      actualPort = await findFreePort(preferredPort);
      command = server.command.replace(/{PORT}/g, actualPort.toString());
    } else {
      // Let server choose (like Vite with config)
      actualPort = preferredPort;
      command = server.command;
    }

    // Get log file path (automatically sanitized)
    const logFilePath = getLogFilePath(serverName);

    // Ensure log directory exists
    const logDir = path.dirname(logFilePath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Add log redirection if not already present
    if (!command.includes('>')) {
      command = `${command} > ${logFilePath} 2>&1`;
    }

    console.log(`Starting ${serverName}...`);
    if (actualPort !== preferredPort) {
      console.log(`Port :${preferredPort} busy, using :${actualPort}`);
    }

    // Start process using shell to handle redirection
    const child = spawn('sh', ['-c', command], {
      detached: true,
      stdio: 'ignore',
      cwd: projectRoot,
    });

    // Verify spawn succeeded
    if (child.pid === undefined) {
      console.error(`❌ Failed to start ${serverName}: spawn returned no PID`);
      notifyError(serverName, 'Failed to spawn process');
      process.exit(1);
    }

    child.unref();

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to detect actual port from logs (for servers that auto-select ports like Next.js)
    try {
      // First try lsof with the PID
      const { stdout } = await execAsync(
        `lsof -i -P -n | grep ${child.pid} | grep LISTEN`
      );
      const portMatch = stdout.match(/:(\d+)\s+\(LISTEN\)/);
      if (portMatch) {
        actualPort = parseInt(portMatch[1]);
      }
    } catch (e) {
      // lsof failed, try parsing log file for Next.js port
      try {
        if (existsSync(logFilePath)) {
          const logContent = readFileSync(logFilePath, 'utf-8');
          // Match Next.js log format: "- Local:        http://localhost:4323"
          const nextPortMatch = logContent.match(
            /Local:\s+http:\/\/localhost:(\d+)/
          );
          if (nextPortMatch) {
            actualPort = parseInt(nextPortMatch[1]);
          }
        }
      } catch (logErr) {
        // Could not detect from logs - use what we configured
      }
    }

    // Health check
    const healthUrl = server.healthCheck
      .replace('{PORT}', String(actualPort))
      .replace(/{ROLE}/g, serverName);

    const isHealthy = await healthCheck(healthUrl);

    if (isHealthy) {
      // Save to PID file
      pidData[serverName] = {
        pid: child.pid,
        port: actualPort,
        startTime: new Date().toISOString(),
        status: 'healthy',
      };
      savePidFile(pidData);

      const portInfo =
        actualPort === preferredPort
          ? `:${actualPort}`
          : `:${preferredPort}→${actualPort}`;
      console.log(`✅ ${serverName} ${portInfo} (pid ${child.pid})`);

      // Notify success
      notifySuccess(serverName, `Started on ${portInfo}`);

      // Start log viewer if configured
      if (logViewerCmd) {
        const logFile = getLogFilePath(serverName);
        console.log(`\nStarting log viewer: ${logViewerCmd} ${logFile}`);
        console.log('Press Ctrl+C to stop following logs\n');

        // Check if log file exists
        if (!existsSync(logFile)) {
          console.log(
            `Warning: Log file ${logFile} not found. Creating empty file...`
          );
          writeFileSync(logFile, '');
        }

        // Parse and execute log viewer command
        const logViewerArgs = logViewerCmd.split(' ');
        const logViewerProcess = spawn(
          logViewerArgs[0],
          [...logViewerArgs.slice(1), logFile],
          {
            stdio: 'inherit',
          }
        );

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          console.log('\n\nStopped following logs');
          logViewerProcess.kill();
          process.exit(0);
        });

        // Monitor if the server process is still running
        const monitorInterval = setInterval(async () => {
          const stillRunning = await isProcessRunning(child.pid!);
          if (!stillRunning) {
            console.log(
              `\n❌ Server ${serverName} (pid ${child.pid}) has stopped`
            );
            notifyError(serverName, 'Stopped unexpectedly');
            clearInterval(monitorInterval);
            logViewerProcess.kill();
            // Clean up PID file
            const currentPidData = loadPidFile();
            delete currentPidData[serverName];
            savePidFile(currentPidData);
            process.exit(0);
          }
        }, 5000);
      }
    } else {
      // Kill the process and report failure
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch (e) {
        // Process might already be dead
      }
      console.error(`❌ ${serverName} failed health check at ${healthUrl}`);
      console.error(`Check logs: npx dev logs ${serverName}`);
      notifyError(serverName, 'Failed health check');
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error starting ${serverName}:`, error.message);
    notifyError(serverName, `Failed to start: ${error.message}`);
    process.exit(1);
  }
}

// Stop servers
async function stopServers(serverName: string | null = null) {
  const pidData = loadPidFile();
  const servers = loadServersConfig();

  // If specific server requested, only stop that one
  // Otherwise stop all servers in PID file
  const serversToStop = serverName ? [serverName] : Object.keys(pidData);

  for (const name of serversToStop) {
    const serverConfig = servers[name];

    // If no PID data but server config exists, try to kill by preferred port
    if (!pidData[name] && serverConfig) {
      console.log(`${name} not in PID file, checking ports...`);

      // Try to detect actual port from logs first
      let actualPort: number | null = null;
      const logFilePath = getLogFilePath(name);
      if (existsSync(logFilePath)) {
        const logContent = readFileSync(logFilePath, 'utf-8');
        const nextPortMatch = logContent.match(
          /Local:\s+http:\/\/localhost:(\d+)/
        );
        if (nextPortMatch) {
          actualPort = parseInt(nextPortMatch[1]);
        }
      }

      // Collect all ports to check: actual port (if detected) + preferred port
      const portsToCheck = new Set<number>();
      if (actualPort) {
        portsToCheck.add(actualPort);
      }
      portsToCheck.add(serverConfig.preferredPort);

      let foundProcesses = false;
      for (const port of portsToCheck) {
        const portPids = await getPidsByPort(port);
        if (portPids.length > 0) {
          foundProcesses = true;
          const portLabel =
            port === serverConfig.preferredPort
              ? `${port} (preferred)`
              : `${port} (actual)`;
          console.log(`🛑 Stopping ${name} on port ${portLabel}...`);
          console.log(
            `🔧 Found ${portPids.length} process(es): ${portPids.join(', ')}`
          );

          for (const portPid of portPids) {
            try {
              await killProcessTree(portPid, 'SIGTERM');
            } catch (e) {
              // Process might already be dead
            }
          }

          // Wait for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Force kill if still there
          const remainingPids = await getPidsByPort(port);
          if (remainingPids.length > 0) {
            console.log(
              `⚠️  Forcing SIGKILL on remaining processes on port ${port}...`
            );
            for (const portPid of remainingPids) {
              try {
                await killProcessTree(portPid, 'SIGKILL');
              } catch (e) {
                // Process might already be dead
              }
            }
          }
        }
      }

      if (!foundProcesses) {
        console.log(`${name} is not running`);
        continue;
      }

      console.log(`✅ ${name} stopped`);
      continue;
    }

    if (!pidData[name]) {
      if (serverName) {
        console.log(`${name} is not running`);
      }
      continue;
    }

    const { pid, port } = pidData[name];
    const preferredPort = servers[name]?.preferredPort;
    const isRunning = await isProcessRunning(pid);

    // Always try to kill by port first (handles orphaned processes)
    // This ensures we clean up even if the wrapper PID is dead
    console.log(`🛑 Stopping ${name} (pid ${pid}, port ${port})...`);

    // First, kill by port to catch any orphaned processes
    const portPids = await getPidsByPort(port);
    if (portPids.length > 0) {
      console.log(
        `🔧 Found ${portPids.length} process(es) on port ${port}: ${portPids.join(', ')}`
      );
      for (const portPid of portPids) {
        try {
          await killProcessTree(portPid, 'SIGTERM');
        } catch (e) {
          // Process might already be dead
        }
      }
    }

    // Then kill the tracked PID if it's still running
    if (isRunning) {
      try {
        // Kill entire process tree (parent + all children)
        await killProcessTree(pid, 'SIGTERM');

        // Wait for graceful shutdown (up to 3 seconds)
        let attempts = 0;
        const maxAttempts = 6; // 6 attempts * 500ms = 3 seconds
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const stillRunning = await isProcessRunning(pid);
          if (!stillRunning) {
            console.log(`✅ ${name} stopped gracefully`);
            notifyInfo(name, 'Stopped');
            break;
          }
          attempts++;
        }

        // If still running after graceful shutdown period, force kill entire tree
        if (await isProcessRunning(pid)) {
          console.log(`⚠️  ${name} didn't stop gracefully, forcing SIGKILL...`);
          await killProcessTree(pid, 'SIGKILL');

          // Wait for SIGKILL to take effect - don't give up
          let killAttempts = 0;
          while (await isProcessRunning(pid)) {
            await new Promise(resolve => setTimeout(resolve, 200));
            killAttempts++;
            if (killAttempts > 10) {
              // After 2 seconds of SIGKILL not working, something is very wrong
              throw new Error(`Process ${pid} won't die even with SIGKILL`);
            }
          }
          console.log(`✅ ${name} force stopped`);
          notifyInfo(name, 'Force stopped');
        }
      } catch (error: any) {
        console.error(`Error stopping ${name}:`, error.message);
        notifyError(name, `Error stopping: ${error.message}`);
      }
    } else {
      console.log(`${name} process not running, cleaning up ports...`);
    }

    // Reclaim ports: both the actual port AND the preferred port
    const portsToReclaim = [port];
    if (preferredPort && preferredPort !== port) {
      portsToReclaim.push(preferredPort);
    }

    for (const portToReclaim of portsToReclaim) {
      const portLabel =
        portToReclaim === preferredPort && portToReclaim !== port
          ? `${portToReclaim} (preferred)`
          : `${portToReclaim}`;

      console.log(`🔓 Reclaiming port ${portLabel}...`);
      let portAttempts = 0;
      while (true) {
        try {
          const { stdout } = await execAsync(`lsof -ti:${portToReclaim}`);
          const pids = stdout
            .trim()
            .split('\n')
            .filter(p => p);

          if (pids.length === 0) {
            // Port is free!
            console.log(`✅ Port ${portLabel} is free`);
            break;
          }

          // Kill everything on this port
          console.log(
            `🔧 Killing ${pids.length} process(es) on port ${portLabel}: ${pids.join(', ')}`
          );
          for (const portPid of pids) {
            try {
              // Start with SIGTERM
              process.kill(parseInt(portPid), 'SIGTERM');
            } catch (e) {
              // Process might already be dead
            }
          }

          // Wait a bit for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check again and use SIGKILL if needed
          try {
            const { stdout: remainingPids } = await execAsync(
              `lsof -ti:${portToReclaim}`
            );
            const remaining = remainingPids
              .trim()
              .split('\n')
              .filter(p => p);

            if (remaining.length > 0) {
              console.log(`⚠️  Port ${portLabel} still held, using SIGKILL...`);
              for (const portPid of remaining) {
                try {
                  process.kill(parseInt(portPid), 'SIGKILL');
                } catch (e) {
                  // Process might already be dead
                }
              }
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (e) {
            // No processes found, port is free
            break;
          }

          portAttempts++;
          if (portAttempts > 20) {
            console.error(
              `❌ Failed to reclaim port ${portLabel} after 20 attempts`
            );
            notifyError(name, `Could not reclaim port ${portLabel}`);
            throw new Error(`Could not reclaim port ${portToReclaim}`);
          }
        } catch (error: any) {
          if (error.message && error.message.includes('Could not reclaim')) {
            throw error;
          }
          // lsof error means no process on port - we're done!
          console.log(`✅ Port ${portLabel} is free`);
          break;
        }
      }
    }

    delete pidData[name];
  }

  savePidFile(pidData);
}

// Show status
async function showStatus() {
  const pidData = loadPidFile();
  const servers = loadServersConfig();

  if (Object.keys(pidData).length === 0) {
    console.log('No servers running');
    return;
  }

  console.log('Running servers:');
  for (const [name, data] of Object.entries(pidData)) {
    const isRunning = await isProcessRunning(data.pid);
    if (isRunning) {
      console.log(
        `  ${name}: port ${data.port} (pid ${data.pid}) - ${data.status}`
      );
    } else {
      console.log(`  ${name}: DEAD (pid ${data.pid}) - cleaning up`);
      delete pidData[name];
    }
  }

  savePidFile(pidData);
}

// List servers (status)
async function listServers() {
  const pidData = loadPidFile();
  const servers = loadServersConfig();

  if (Object.keys(pidData).length === 0) {
    console.log('No servers running');
    return;
  }

  // Build table rows
  const rows: Array<{
    status: string;
    server: string;
    url: string;
    pid: number | string;
    port: string;
  }> = [];
  for (const [name, data] of Object.entries(pidData)) {
    const isRunning = await isProcessRunning(data.pid);
    const server = servers[name];

    // Health check
    let statusText = 'dead';
    let statusIcon = '[X]'; // dead
    if (isRunning && server) {
      const healthUrl = server.healthCheck.replace(
        '{PORT}',
        data.port.toString()
      );
      const isHealthy = await healthCheck(healthUrl, 2000);
      if (isHealthy) {
        statusText = 'up';
        statusIcon = '[*]'; // healthy
      } else {
        statusText = 'unhealthy';
        statusIcon = '[!]'; // unhealthy
      }
    } else if (isRunning) {
      statusText = 'up';
      statusIcon = '[*]'; // healthy
    }

    // Port display
    const portInfo =
      server && data.port !== server.preferredPort
        ? `:${server.preferredPort}→${data.port}`
        : `:${data.port}`;

    // Main row
    rows.push({
      status: `${statusIcon} ${statusText}`,
      server: name,
      url: `http://localhost:${data.port}`,
      pid: data.pid,
      port: portInfo,
    });

    // Network IP sub-row
    const networkIp = getNetworkIP();
    if (networkIp && networkIp !== '127.0.0.1') {
      rows.push({
        status: '',
        server: '  |--',
        url: `http://${networkIp}:${data.port}`,
        pid: '',
        port: '',
      });
    }

    if (!isRunning) {
      delete pidData[name];
    }
  }

  // Fixed column widths for consistent watch output
  const widths = {
    status: 14, // "[*] up" or "[X] dead" or "[!] unhealthy"
    server: 10,
    url: 30,
    pid: 6,
    port: 10,
  };

  // Print header
  console.log(
    [
      'STATUS'.padEnd(widths.status),
      'SERVER'.padEnd(widths.server),
      'URL'.padEnd(widths.url),
      'PID'.padEnd(widths.pid),
      'PORT',
    ].join('  ')
  );

  console.log(
    '─'.repeat(
      widths.status + widths.server + widths.url + widths.pid + widths.port + 8
    )
  );

  // Print rows
  for (const row of rows) {
    const statusStr = row.status.padEnd(widths.status);
    const serverStr = row.server.padEnd(widths.server);
    const urlStr = row.url.padEnd(widths.url);
    const pidStr = String(row.pid).padEnd(widths.pid);
    const portStr = row.port;

    console.log([statusStr, serverStr, urlStr, pidStr, portStr].join('  '));
  }

  savePidFile(pidData);
}

// Show logs for a server
async function showLogs(serverName: string | null) {
  const pidData = loadPidFile();

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
      runningServers.forEach(name => console.log(`  npx dev logs ${name}`));
      return;
    }
  }

  if (!pidData[serverName]) {
    console.log(`Server '${serverName}' is not running`);
    return;
  }

  const { pid, port } = pidData[serverName];
  const logFile = getLogFilePath(serverName);

  console.log(`Following logs for ${serverName} (pid ${pid}, port ${port})`);
  console.log(`Log file: ${logFile}`);
  console.log('Press Ctrl+C to stop following logs\n');

  // Check if log file exists
  if (!existsSync(logFile)) {
    console.log(
      `Log file not found. Server may have been started before logging was implemented.`
    );
    console.log(
      `Restart the server to enable logging: npm run stop && npm run dev\n`
    );
    return;
  }

  // Use tail -f to follow the log file
  const tailProcess = spawn('tail', ['-f', logFile], {
    stdio: 'inherit',
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\nStopped following logs');
    tailProcess.kill();
    process.exit(0);
  });

  // Monitor if the server process is still running
  const monitorInterval = setInterval(async () => {
    const stillRunning = await isProcessRunning(pid);
    if (!stillRunning) {
      console.log(`\n❌ Server ${serverName} (pid ${pid}) has stopped`);
      notifyError(serverName!, 'Stopped unexpectedly');
      clearInterval(monitorInterval);
      tailProcess.kill();
      // Clean up PID file
      const currentPidData = loadPidFile();
      delete currentPidData[serverName!];
      savePidFile(currentPidData);
      process.exit(0);
    }
  }, 5000);
}

// Cleanup stale entries
async function cleanup() {
  const pidData = loadPidFile();
  const cleanedData: PidData = {};

  for (const [name, data] of Object.entries(pidData)) {
    const isRunning = await isProcessRunning(data.pid);
    if (isRunning) {
      cleanedData[name] = data;
    } else {
      console.log(`Cleaned up stale entry: ${name} (pid ${data.pid})`);
    }
  }

  savePidFile(cleanedData);
}

// Get all descendant PIDs of a process (children, grandchildren, etc.)
async function getAllDescendantPids(parentPid: number): Promise<number[]> {
  try {
    // Use pgrep to find all descendants recursively
    const { stdout } = await execAsync(`pgrep -P ${parentPid}`);
    const childPids = stdout
      .trim()
      .split('\n')
      .map(pid => parseInt(pid))
      .filter(pid => !isNaN(pid));

    // Recursively get descendants of each child
    const allDescendants = [...childPids];
    for (const childPid of childPids) {
      const grandchildren = await getAllDescendantPids(childPid);
      allDescendants.push(...grandchildren);
    }

    return allDescendants;
  } catch {
    return [];
  }
}

// Find all PIDs listening on a specific port
async function getPidsByPort(port: number): Promise<number[]> {
  try {
    const { stdout } = await execAsync(`lsof -ti :${port}`);
    return stdout
      .trim()
      .split('\n')
      .map(pid => parseInt(pid))
      .filter(pid => !isNaN(pid));
  } catch {
    return [];
  }
}

// Kill entire process tree (parent + all descendants)
async function killProcessTree(
  pid: number,
  signal: NodeJS.Signals = 'SIGTERM'
): Promise<void> {
  try {
    // Get all descendant PIDs first
    const descendants = await getAllDescendantPids(pid);

    // Kill descendants first (bottom-up)
    for (const descendantPid of descendants.reverse()) {
      try {
        process.kill(descendantPid, signal);
      } catch {
        // Process might already be dead
      }
    }

    // Finally kill the parent
    try {
      process.kill(pid, signal);
    } catch {
      // Process might already be dead
    }
  } catch (err) {
    // Ignore errors - process tree cleanup is best-effort
  }
}

// Doctor command - show status + configuration
async function doctor() {
  const servers = loadServersConfig();
  const serversConfigExists = existsSync(serversConfigPath);

  if (!serversConfigExists) {
    console.log('ERROR: .dev/servers.json missing');
    console.log('  → npx dev init\n');
    return;
  }

  // Show status first
  await listServers();

  // Then show configuration
  console.log(`\nConfiguration:`);
  console.log(`  Path: ${serversConfigPath}`);
  console.log(`  Content:`);
  const configContent = JSON.stringify(servers, null, 2);
  configContent.split('\n').forEach(line => {
    console.log(`    ${line}`);
  });
}

// Initialize dev environment
function initializeDevEnvironment() {
  // Check if servers.json already exists
  if (existsSync(serversConfigPath)) {
    console.error(
      'Error: .dev/servers.json already exists. Remove it first if you want to reinitialize.'
    );
    process.exit(1);
  }

  // Ensure directories exist
  const logDir = path.join(devDir, 'log');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Read package.json to infer servers
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.error('Error: package.json not found in project root');
    process.exit(1);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};

  // Define patterns to detect server scripts
  const serverPatterns = ['dev', 'start', 'serve', 'preview'];
  const inferredServers: ServersConfig = {};
  let portCounter = 3000;

  for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
    // Check if script name matches server patterns
    const isServerScript = serverPatterns.some(
      pattern =>
        scriptName.includes(pattern) &&
        !scriptName.includes('build') &&
        !scriptName.includes('test') &&
        !scriptName.includes('lint')
    );

    if (isServerScript && !(scriptCommand as string).includes('npx dev')) {
      // Generate server configuration
      const serverName = scriptName.replace(/^(npm run |yarn |pnpm )?/, '');
      const logPath = `.dev/log/${serverName}.log`;

      inferredServers[serverName] = {
        command: `npm run ${scriptName} > ${logPath} 2>&1`,
        preferredPort: portCounter,
        healthCheck: `http://localhost:{PORT}`,
      };

      portCounter += 10; // Space out ports
    }
  }

  if (Object.keys(inferredServers).length === 0) {
    console.log('No server scripts detected in package.json');
    console.log('Creating minimal configuration...');

    // Create minimal default configuration
    inferredServers.dev = {
      command: 'npm run dev > .dev/log/dev.log 2>&1',
      preferredPort: 3000,
      healthCheck: 'http://localhost:{PORT}',
    };
  }

  // Write servers.json
  writeFileSync(serversConfigPath, JSON.stringify(inferredServers, null, 2));
  console.log(
    `✅ Created .dev/servers.json with ${Object.keys(inferredServers).length} server(s):`
  );

  for (const serverName of Object.keys(inferredServers)) {
    console.log(`  - ${serverName}`);
  }

  // Create empty pid.json
  writeFileSync(pidFilePath, JSON.stringify({}, null, 2));
  console.log('✅ Created .dev/pid.json');
  console.log('✅ Created .dev/log/ directory');

  console.log('\nYou can now run:');
  console.log('  npx dev start        # Start first server');
  console.log('  npx dev start <name>  # Start specific server');
  console.log('  npx dev status        # Check running servers');
}

// Known commands (command-first pattern)
const COMMANDS = [
  'start',
  'stop',
  'restart',
  'status',
  'logs',
  'doctor',
  'cleanup',
  'init',
  'help',
];

// Parse CLI arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed: {
    command: string | null;
    serverName: string | null;
    logViewer: string | null;
  } = {
    command: null,
    serverName: null,
    logViewer: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--log-viewer' && i + 1 < args.length) {
      parsed.logViewer = args[i + 1];
      i++; // Skip next argument as it's the value
    } else if (!parsed.command) {
      parsed.command = arg;
    } else if (!parsed.serverName) {
      parsed.serverName = arg;
    }
  }

  return parsed;
}

// Get log viewer command with priority: CLI args > env vars > default
function getLogViewerCommand(cliLogViewer: string | null): string {
  return cliLogViewer || process.env.DEV_LOG_VIEWER || 'tail -f';
}

// Show help
function showHelp() {
  const pidData = loadPidFile();
  const servers = loadServersConfig();
  const running = Object.keys(pidData).length;

  if (running > 0) {
    console.log('Running:');
    for (const [name, data] of Object.entries(pidData)) {
      const server = servers[name];
      const portInfo =
        server && data.port !== server.preferredPort
          ? `:${server.preferredPort}→${data.port}`
          : `:${data.port}`;
      console.log(`  ${name} ${portInfo}`);
    }
    console.log('');
  }

  console.log(`Usage: npx dev <command> [name]
       npx dev [name]

Commands:
  start [name]         Start server (first server if no name)
  stop [name]          Stop server (all servers if no name)
  restart [name]       Restart server
  status [name]        Show running servers with health
  logs [name]          Follow server logs
  doctor               Diagnose environment issues
  cleanup              Remove stale pid entries
  init                 Initialize .dev/ from package.json

Shorthand:
  npx dev              Start first server
  npx dev <name>       Start named server

Examples:
  npx dev start web    Start web server
  npx dev stop         Stop all servers
  npx dev stop web     Stop web server
  npx dev restart api  Restart API server
  npx dev status       Show all running servers
  npx dev logs web     Follow web server logs
`);
}

// Main CLI
const { command, serverName, logViewer } = parseArguments();
const logViewerCommand = getLogViewerCommand(logViewer);

// Handle commands that don't need servers.json first
if (command === 'init') {
  initializeDevEnvironment();
  process.exit(0);
}

if (command === 'help') {
  showHelp();
  process.exit(0);
}

// Now load config for commands that need it
const servers = loadServersConfig();

// Determine if first arg is a command or a server name (shorthand)
const isKnownCommand = command && COMMANDS.includes(command);
const isServerName = command && servers[command];

// Resolve actual command and server
let actualCommand: string;
let actualServerName: string | null;

if (isKnownCommand) {
  // Command-first: npx dev start web
  actualCommand = command;
  actualServerName = serverName;
} else if (isServerName) {
  // Shorthand: npx dev web → npx dev start web
  actualCommand = 'start';
  actualServerName = command;
} else if (!command) {
  // No args: npx dev → npx dev start (first server)
  actualCommand = 'start';
  actualServerName = null;
} else {
  // Unknown command
  console.error(`Unknown command or server: ${command}`);
  console.log('');
  showHelp();
  process.exit(1);
}

// Execute command
switch (actualCommand) {
  case 'start': {
    if (!actualServerName) {
      // Start first server in config
      const firstServer = Object.keys(servers)[0];
      if (firstServer) {
        await startServer(firstServer, logViewerCommand);
      } else {
        console.error('No servers configured in .dev/servers.json');
        process.exit(1);
      }
    } else {
      if (!servers[actualServerName]) {
        console.error(`Unknown server: ${actualServerName}`);
        console.log(`Available servers: ${Object.keys(servers).join(', ')}`);
        process.exit(1);
      }
      await startServer(actualServerName, logViewerCommand);
    }
    break;
  }

  case 'stop':
    await stopServers(actualServerName);
    break;

  case 'restart': {
    if (!actualServerName) {
      console.error('Server name required for restart');
      console.log('Usage: npx dev restart <name>');
      process.exit(1);
    }
    if (!servers[actualServerName]) {
      console.error(`Unknown server: ${actualServerName}`);
      console.log(`Available servers: ${Object.keys(servers).join(', ')}`);
      process.exit(1);
    }
    await stopServers(actualServerName);
    await startServer(actualServerName, logViewerCommand);
    break;
  }

  case 'status':
    await listServers();
    break;

  case 'logs':
    await showLogs(actualServerName);
    break;

  case 'cleanup':
    await cleanup();
    break;

  case 'doctor':
    await doctor();
    break;

  case 'help':
    showHelp();
    break;

  default:
    showHelp();
    break;
}
