import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

export interface ServerConfig {
  command: string;
  preferredPort: number;
  healthCheck: string;
}

export interface Servers {
  [key: string]: ServerConfig;
}

const getDevDir = (projectRoot: string) => path.join(projectRoot, '.dev');
const getServersConfigPath = (projectRoot: string) => path.join(getDevDir(projectRoot), 'servers.json');
const getPidFilePath = (projectRoot: string) => path.join(getDevDir(projectRoot), 'pid.json');

export const ensureDevDirExists = (projectRoot: string) => {
  const devDir = getDevDir(projectRoot);
  if (!existsSync(devDir)) {
    mkdirSync(devDir, { recursive: true });
  }
};

export const loadServersConfig = (projectRoot: string): Servers => {
  const serversConfigPath = getServersConfigPath(projectRoot);
  if (!existsSync(serversConfigPath)) {
    console.error('Error: .dev/servers.json not found');
    console.log('Run "npx dev init" to create initial configuration');
    process.exit(1);
  }
  return JSON.parse(readFileSync(serversConfigPath, 'utf8'));
};

export const initializeDevEnvironment = (projectRoot: string): void => {
  const serversConfigPath = getServersConfigPath(projectRoot);
  const pidFilePath = getPidFilePath(projectRoot);

  // Check if servers.json already exists
  if (existsSync(serversConfigPath)) {
    console.error('Error: .dev/servers.json already exists. Remove it first if you want to reinitialize.');
    process.exit(1);
  }

  // Ensure directories exist
  const logDir = path.join(getDevDir(projectRoot), 'log');
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
  const serverPatterns: string[] = ['dev', 'start', 'serve', 'preview'];
  const inferredServers: Servers = {};
  let portCounter = 3000;

  for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
    // Check if script name matches server patterns and exclude dev calls
    const isServerScript = serverPatterns.some(pattern =>
      scriptName.includes(pattern) &&
      !scriptName.includes('build') &&
      !scriptName.includes('test') &&
      !scriptName.includes('lint')
    ) && !(scriptCommand as string).includes('dev');

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
  writeFileSync(serversConfigPath, JSON.stringify(inferredServers, null, 2));
  console.log(`✅ Created .dev/servers.json with ${Object.keys(inferredServers).length} server(s):`);

  for (const serverName of Object.keys(inferredServers)) {
    console.log(`  - ${serverName}`);
  }

  // Create empty pids.json
  writeFileSync(pidFilePath, JSON.stringify({}, null, 2));
  console.log('✅ Created .dev/pid.json');
  console.log('✅ Created .dev/log/ directory');

  console.log('\nYou can now run:');
  console.log('  npx dev start        # Start first server');
  console.log('  npx dev start <name> # Start specific server');
  console.log('  npx dev status       # Check running servers');
};

