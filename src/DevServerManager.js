import { ConfigManager } from './ConfigManager.js';
import { ProcessManager } from './ProcessManager.js';
import { LogManager } from './LogManager.js';
import { HealthChecker } from './HealthChecker.js';

export class DevServerManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.configManager = new ConfigManager(projectRoot);
    this.processManager = new ProcessManager(projectRoot);
    this.logManager = new LogManager(projectRoot);
    this.healthChecker = new HealthChecker();
  }

  async run() {
    const { command, serverName, logViewer } = this.parseArguments();

    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        this.showHelp();
        break;

      case 'start':
      case undefined: {
        const logViewerCommand = this.getLogViewerCommand(logViewer);
        if (!serverName) {
          const servers = this.configManager.loadServersConfig();
          const firstServer = Object.keys(servers)[0];
          if (firstServer) {
            await this.startServer(firstServer, logViewerCommand);
          } else {
            console.error('No servers configured in .dev/servers.json');
          }
        } else {
          await this.startServer(serverName, logViewerCommand);
        }
        break;
      }

      case 'stop':
        await this.processManager.stopServers(serverName);
        break;

      case 'status':
        await this.showStatus();
        break;

      case 'port':
        this.showPorts();
        break;

      case 'logs':
        await this.logManager.showLogs(serverName);
        break;

      case 'cleanup':
        await this.processManager.cleanup();
        break;

      case 'init':
        this.configManager.initializeDevEnvironment();
        break;

      default:
        if (command && !['start', 'stop', 'status', 'port', 'logs', 'cleanup', 'init', 'help'].includes(command)) {
          const logViewerCommand = this.getLogViewerCommand(logViewer);
          await this.startServer(command, logViewerCommand);
        } else {
          this.showHelp();
        }
    }
  }

  async startServer(serverName, logViewerCmd = null) {
    const servers = this.configManager.loadServersConfig();
    const server = servers[serverName];

    if (!server) {
      console.error(`Error: Server '${serverName}' not found in .dev/servers.json`);
      process.exit(1);
    }

    const pidData = this.processManager.loadPidFile();

    // Check if already running
    if (pidData[serverName]) {
      const isRunning = await this.processManager.isProcessRunning(pidData[serverName].pid);
      if (isRunning) {
        console.log(`${serverName} is already running on port ${pidData[serverName].port} (pid ${pidData[serverName].pid})`);
        return;
      } else {
        // Clean up stale entry
        delete pidData[serverName];
        this.processManager.savePidFile(pidData);
      }
    }

    try {
      // For Vite, let it choose its own port, for others use our port management
      let port, command;

      if (server.command.includes('{PORT}')) {
        // Port-managed server
        port = await this.processManager.findFreePort(server.preferredPort);
        command = server.command.replace('{PORT}', port);
      } else {
        // Let server choose (like Vite with config)
        port = server.preferredPort;
        command = server.command;
      }

      // Replace {ROLE} template variable with server name
      command = command.replace(/{ROLE}/g, serverName);

      console.log(`Starting ${serverName}...`);
      console.log(`Command: ${command}`);

      const child = await this.processManager.startProcess(command, serverName);

      console.log(`Started process with PID: ${child.pid}`);

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to detect actual port by checking what's listening
      port = await this.processManager.detectPortFromProcess(child.pid, port);

      // Health check
      const healthUrl = server.healthCheck.replace('{PORT}', port).replace(/{ROLE}/g, serverName);
      console.log(`Health checking ${healthUrl}...`);

      const isHealthy = await this.healthChecker.check(healthUrl);

      if (isHealthy) {
        // Save to PID file
        pidData[serverName] = {
          pid: child.pid,
          port,
          startTime: new Date().toISOString(),
          status: 'healthy'
        };
        this.processManager.savePidFile(pidData);
        console.log(`✅ ${serverName} started successfully on port ${port} (pid ${child.pid})`);

        // Start log viewer if configured
        if (logViewerCmd) {
          await this.logManager.startLogViewer(serverName, logViewerCmd, child.pid);
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
      console.error(`Error starting ${serverName}:`, error.message);
      process.exit(1);
    }
  }

  async showStatus() {
    const pidData = this.processManager.loadPidFile();

    if (Object.keys(pidData).length === 0) {
      console.log('No servers running');
      return;
    }

    console.log('Running servers:');
    for (const [name, data] of Object.entries(pidData)) {
      const isRunning = await this.processManager.isProcessRunning(data.pid);
      if (isRunning) {
        console.log(`  ${name}: port ${data.port} (pid ${data.pid}) - ${data.status}`);
      } else {
        console.log(`  ${name}: DEAD (pid ${data.pid}) - cleaning up`);
        delete pidData[name];
      }
    }

    this.processManager.savePidFile(pidData);
  }

  showPorts() {
    const pidData = this.processManager.loadPidFile();

    if (Object.keys(pidData).length === 0) {
      console.log('No servers running');
      return;
    }

    for (const [name, data] of Object.entries(pidData)) {
      console.log(`${name}: ${data.port}`);
    }
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const parsed = {
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
  }

  getLogViewerCommand(cliLogViewer) {
    return cliLogViewer || process.env.DEV_LOG_VIEWER || 'tail -f';
  }

  showHelp() {
    console.log(`Usage: npx dev-server-manager [command] [server] [options]

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
  npx dev-server-manager frontend    # Same as: npx dev-server-manager start frontend
  npx dev-server-manager             # Start first configured server`);
  }
}