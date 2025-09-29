import { ensureDevDirExists, loadServersConfig, initializeDevEnvironment, Servers, ServerConfig } from './config.js';
import { loadPidFile, savePidFile, isProcessRunning, findFreePort, detectPortFromProcess, startProcess, stopServers, cleanup, PidData } from './process.js';
import { startLogViewer, showLogs } from './log.js';
import { checkHealth } from './health.js';

interface Arguments {
  command: string | null;
  serverName: string | null;
  logViewer: string | null;
}

const parseArguments = (): Arguments => {
  const args = process.argv.slice(2);
  const parsed: Arguments = {
    command: null,
    serverName: null,
    logViewer: null
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
};

const getLogViewerCommand = (cliLogViewer: string | null): string => {
  return cliLogViewer || process.env.DEV_LOG_VIEWER || 'tail -f';
};

const showHelp = (): void => {
  console.log(`Usage: npx dev [command] [server] [options]

Commands:
  init            Initialize .dev directory and infer servers from package.json
  start [server]  Start a server (default: first server)
  stop [server]   Stop server(s) (default: all)
  status          Show running servers
  port            Show server ports
  logs [server]   Monitor server status and health
  cleanup         Remove stale entries

Options:
  --log-viewer "cmd"  Custom log viewer command (default: tail -f)

Environment Variables:
  DEV_LOG_VIEWER      Default log viewer command

Server shortcuts:
  npx dev frontend    # Same as: npx dev start frontend
  npx dev             # Start first configured server`);
};

const startServer = async (projectRoot: string, serverName: string, logViewerCmd: string | null = null): Promise<void> => {
  const servers = loadServersConfig(projectRoot);
  const server = servers[serverName];

  if (!server) {
    console.error(`Error: Server '${serverName}' not found in .dev/servers.json`);
    process.exit(1);
  }

  const pidData = loadPidFile(projectRoot);

  // Check if already running
  if (pidData[serverName]) {
    const isRunning = await isProcessRunning(pidData[serverName].pid);
    if (isRunning) {
      console.log(`${serverName} is already running on port ${pidData[serverName].port} (pid ${pidData[serverName].pid})`);
      return;
    } else {
      // Clean up stale entry
      delete pidData[serverName];
      savePidFile(projectRoot, pidData);
    }
  }

  try {
    // For Vite, let it choose its own port, for others use our port management
    let port: number, command: string;

    if (server.command.includes('{PORT}')) {
      // Port-managed server
      port = await findFreePort(server.preferredPort);
      command = server.command.replace('{PORT}', port.toString());
    } else {
      // Let server choose (like Vite with config)
      port = server.preferredPort;
      command = server.command;
    }

    // Replace {ROLE} template variable with server name
    command = command.replace(/{ROLE}/g, serverName);

    console.log(`Starting ${serverName}...`);
    console.log(`Command: ${command}`);

    const { child, output } = await startProcess(projectRoot, command, serverName); // Destructure child and output

    if (typeof child.pid !== 'number') {
      console.error(`Failed to start process for ${serverName}`);
      return;
    }

    console.log(`Started process with PID: ${child.pid}`);

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Try to detect actual port by checking what's listening
    port = await detectPortFromProcess(child.pid, port, output); // Pass output to detectPortFromProcess

    // Health check
    const healthUrl = server.healthCheck.replace('{PORT}', port.toString()).replace(/{ROLE}/g, serverName);
    console.log(`Health checking ${healthUrl}...`);

    const isHealthy = await checkHealth(healthUrl);

    if (isHealthy) {
      // Save to PID file
      pidData[serverName] = {
        pid: child.pid,
        port,
        startTime: new Date().toISOString(),
        status: 'healthy'
      };
      savePidFile(projectRoot, pidData);
      console.log(`✅ ${serverName} started successfully on port ${port} (pid ${child.pid})`);

      // Start log viewer if configured
      if (logViewerCmd) {
        await startLogViewer(projectRoot, serverName, logViewerCmd, child.pid);
      }
    } else {
      // Kill the process and report failure
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch (_e) {
        // Process might already be dead
      }
      console.error(`❌ ${serverName} failed health check at ${healthUrl}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error starting ${serverName}:`, (error as Error).message);
    process.exit(1);
  }
};

const showStatus = async (projectRoot: string): Promise<void> => {
  const pidData = loadPidFile(projectRoot);

  if (Object.keys(pidData).length === 0) {
    console.log('No servers running');
    return;
  }

  console.log('Running servers:');
  for (const [name, data] of Object.entries(pidData)) {
    if (data) {
      const isRunning = await isProcessRunning(data.pid);
      if (isRunning) {
        console.log(`  ${name}: port ${data.port} (pid ${data.pid}) - ${data.status}`);
      } else {
        console.log(`  ${name}: DEAD (pid ${data.pid}) - cleaning up`);
        delete pidData[name];
      }
    }
  }

  savePidFile(projectRoot, pidData);
};

const showPorts = (projectRoot: string): void => {
  const pidData = loadPidFile(projectRoot);

  if (Object.keys(pidData).length === 0) {
    console.log('No servers running');
    return;
  }

  for (const [name, data] of Object.entries(pidData)) {
    if (data) {
      console.log(`${name}: ${data.port}`);
    }
  }
};

export const dev = async (projectRoot: string = process.cwd()): Promise<void> => {
  ensureDevDirExists(projectRoot);
  const { command, serverName, logViewer } = parseArguments();

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    case 'start':
    case undefined: {
      const logViewerCommand = getLogViewerCommand(logViewer);
      if (!serverName) {
        const servers = loadServersConfig(projectRoot);
        const firstServer = Object.keys(servers)[0];
        if (firstServer) {
          await startServer(projectRoot, firstServer, logViewerCommand);
        } else {
          console.error('No servers configured in .dev/servers.json');
        }
      } else {
        await startServer(projectRoot, serverName, logViewerCommand);
      }
      break;
    }

    case 'stop':
      await stopServers(projectRoot, serverName);
      break;

    case 'status':
      await showStatus(projectRoot);
      break;

    case 'port':
      showPorts(projectRoot);
      break;

    case 'logs':
      await showLogs(projectRoot, serverName);
      break;

    case 'cleanup':
      await cleanup(projectRoot);
      break;

    case 'init':
      initializeDevEnvironment(projectRoot);
      break;

    default:
      // If command is not recognized, show help and exit with error
      showHelp();
      process.exit(1);
  }
};