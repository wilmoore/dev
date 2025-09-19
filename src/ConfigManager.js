import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export class ConfigManager {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.devDir = path.join(projectRoot, '.dev');
    this.serversConfigPath = path.join(this.devDir, 'servers.json');
    this.pidFilePath = path.join(this.devDir, 'pid.json');

    // Ensure .dev directory exists
    if (!existsSync(this.devDir)) {
      mkdirSync(this.devDir, { recursive: true });
    }
  }

  loadServersConfig() {
    if (!existsSync(this.serversConfigPath)) {
      console.error('Error: .dev/servers.json not found');
      console.log('Run "npx dev-server-manager init" to create initial configuration');
      process.exit(1);
    }
    return JSON.parse(readFileSync(this.serversConfigPath, 'utf8'));
  }

  initializeDevEnvironment() {
    // Check if servers.json already exists
    if (existsSync(this.serversConfigPath)) {
      console.error('Error: .dev/servers.json already exists. Remove it first if you want to reinitialize.');
      process.exit(1);
    }

    // Ensure directories exist
    const logDir = path.join(this.devDir, 'log');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Read package.json to infer servers
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      console.error('Error: package.json not found in project root');
      process.exit(1);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};

    // Define patterns to detect server scripts
    const serverPatterns = ['dev', 'start', 'serve', 'preview'];
    const inferredServers = {};
    let portCounter = 3000;

    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
      // Check if script name matches server patterns and exclude dev-server-manager calls
      const isServerScript = serverPatterns.some(pattern =>
        scriptName.includes(pattern) &&
        !scriptName.includes('build') &&
        !scriptName.includes('test') &&
        !scriptName.includes('lint')
      ) && !scriptCommand.includes('dev-server-manager');

      if (isServerScript) {
        // Generate server configuration
        const serverName = scriptName.replace(/^(npm run |yarn |pnpm )?/, '');
        const logPath = `.dev/log/${serverName}.log`;

        inferredServers[serverName] = {
          command: `npm run ${scriptName} > ${logPath} 2>&1`,
          preferredPort: portCounter,
          healthCheck: `http://localhost:{PORT}`
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
        healthCheck: 'http://localhost:{PORT}'
      };
    }

    // Write servers.json
    writeFileSync(this.serversConfigPath, JSON.stringify(inferredServers, null, 2));
    console.log(`✅ Created .dev/servers.json with ${Object.keys(inferredServers).length} server(s):`);

    for (const serverName of Object.keys(inferredServers)) {
      console.log(`  - ${serverName}`);
    }

    // Create empty pids.json
    writeFileSync(this.pidFilePath, JSON.stringify({}, null, 2));
    console.log('✅ Created .dev/pid.json');
    console.log('✅ Created .dev/log/ directory');

    console.log('\nYou can now run:');
    console.log('  npx dev-server-manager start        # Start first server');
    console.log('  npx dev-server-manager start <name> # Start specific server');
    console.log('  npx dev-server-manager status       # Check running servers');
  }
}