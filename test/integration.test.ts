import { test } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Note: Console mocking is handled per-test in runDevCommand

// Test helper to create a temporary project directory
const createTempProject = async (): Promise<string> => {
  const tempDir = await fs.mkdtemp('/tmp/dev-test-');
  
  // Create a mock package.json with some scripts
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    scripts: {
      'dev': 'echo "frontend server running on port 3000" && sleep 10',
      'api': 'echo "api server running on port 3001" && sleep 10',
      'build': 'echo "building..."'
    }
  };
  
  await fs.writeFile(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  return tempDir;
};

// Test helper to clean up temp directory
const cleanupTempProject = async (tempDir: string): Promise<void> => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
};

// Test helper to run dev function with mocked process.argv
const runDevCommand = async (tempDir: string, args: string[]): Promise<{ code: number; output: string }> => {
  let output = '';
  let code = 0;

  const tsNodePath = path.resolve(process.cwd(), 'node_modules/.bin/ts-node');
  const child = spawn(tsNodePath, ['bin/dev', tempDir, ...args], {
    cwd: process.cwd(),
    shell: true,
  });

  child.stdout.on('data', (data) => {
    output += data.toString();
  });

  child.stderr.on('data', (data) => {
    output += data.toString();
  });

  await new Promise<void>((resolve) => {
    child.on('close', (exitCode) => {
      code = exitCode ?? 1; // Default to 1 if exitCode is null (e.g., killed by signal)
      resolve();
    });
  });

  return { code, output };
};

test('Core dev tool workflow integration test', async () => {
  const tempDir = await createTempProject();
  
  try {
    // Test 1: Initialize the dev environment
    const initResult = await runDevCommand(tempDir, ['init']);
    assert.strictEqual(initResult.code, 0, 'Init command should succeed');
    
    // Verify .dev directory was created
    const devDir = path.join(tempDir, '.dev');
    const devDirExists = await fs.access(devDir).then(() => true).catch(() => false);
    assert.ok(devDirExists, '.dev directory should be created');
    
    // Verify servers.json was created
    const serversJsonPath = path.join(devDir, 'servers.json');
    const serversJsonExists = await fs.access(serversJsonPath).then(() => true).catch(() => false);
    assert.ok(serversJsonExists, 'servers.json should be created');
    
    // Verify servers.json content
    const serversConfig = JSON.parse(await fs.readFile(serversJsonPath, 'utf8'));
    assert.ok(serversConfig.dev, 'dev server should be configured');
    assert.strictEqual(serversConfig.dev.preferredPort, 3000, 'dev server should have port 3000');
    
    // Test 2: Check status (should show no servers running)
    const statusResult = await runDevCommand(tempDir, ['status']);
    assert.strictEqual(statusResult.code, 0, 'Status command should succeed');
    assert.ok(statusResult.output.includes('No servers running'), 'Should show no servers running initially');
    
    // Test 3: Test help command
    const helpResult = await runDevCommand(tempDir, ['help']);
    assert.strictEqual(helpResult.code, 0, 'Help command should succeed');
    assert.ok(helpResult.output.includes('Usage: npx dev'), 'Help should show usage information');
    
    // Test 4: Test cleanup command
  } finally {
    await cleanupTempProject(tempDir);
  }
});

test('Configuration file validation', async () => {
  const tempDir = await createTempProject();
  
  try {
    // Initialize
    await runDevCommand(tempDir, ['init']);
    
    // Read and validate the generated configuration
    const serversConfig = JSON.parse(
      await fs.readFile(path.join(tempDir, '.dev', 'servers.json'), 'utf8')
    );
    
    // Validate structure - should only have 'dev' server
    assert.ok(serversConfig.dev, 'dev server should be configured');
    assert.strictEqual(Object.keys(serversConfig).length, 1, 'Should only have one server configured');
    
    const serverConfig = serversConfig.dev;
    
    // Check required fields
    assert.ok(serverConfig.command, 'dev server should have a command');
    assert.ok(typeof serverConfig.preferredPort === 'number', 'dev server should have a numeric preferredPort');
    assert.ok(serverConfig.healthCheck, 'dev server should have a healthCheck URL');
    
    // Check command contains log redirection
    assert.ok(serverConfig.command.includes('> .dev/log/'), 'dev command should redirect to log file');
    assert.ok(serverConfig.command.includes('2>&1'), 'dev command should redirect stderr to stdout');
    
    // Check health check URL contains PORT placeholder
    assert.ok(serverConfig.healthCheck.includes('{PORT}'), 'dev health check should contain {PORT} placeholder');
    
    // Check log file naming
    assert.ok(serverConfig.command.includes('dev.log'), 'dev command should log to dev.log');
    
    console.log('✅ Configuration validation passed!');
    
  } finally {
    await cleanupTempProject(tempDir);
  }
});

test.skip('Error handling and edge cases', async () => {
  let tempDir: string | undefined;

  try {
    tempDir = await createTempProject();

    // Test 1: Try to start a non-existent server
    const invalidServerResult = await runDevCommand(tempDir, ['start', 'nonexistent']);
    assert.strictEqual(invalidServerResult.code, 1, 'Should fail when starting non-existent server');
    assert.ok(invalidServerResult.output.includes('not found'), 'Should show appropriate error message');

    // Test 2: Try to run commands before initialization
    const tempDir2 = await createTempProject();
    try {
      const noInitResult = await runDevCommand(tempDir2, ['start']);
      assert.strictEqual(noInitResult.code, 1, 'Should fail when not initialized');
    } finally {
      await cleanupTempProject(tempDir2);
    }

    // Test 3: Initialize and then try invalid commands
    await runDevCommand(tempDir, ['init']);

    const invalidCommandResult = await runDevCommand(tempDir, ['invalid-command']);
    assert.strictEqual(invalidCommandResult.code, 1, 'Invalid commands should show help');
    assert.ok(invalidCommandResult.output.includes('Usage: npx dev'), 'Should show help for invalid commands');

    console.log('✅ Error handling tests passed!');

  } finally {
    if (tempDir) {
      await cleanupTempProject(tempDir);
    }
  }
});