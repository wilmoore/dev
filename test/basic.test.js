import { test } from 'node:test';
import assert from 'node:assert';
import { DevServerManager } from '../src/index.js';

test('DevServerManager exports', () => {
  assert.ok(DevServerManager);
  assert.strictEqual(typeof DevServerManager, 'function');
});

test('DevServerManager instantiation', () => {
  const manager = new DevServerManager('/tmp/test-project');
  assert.ok(manager);
  assert.strictEqual(manager.projectRoot, '/tmp/test-project');
});

test('DevServerManager has required methods', () => {
  const manager = new DevServerManager();
  assert.strictEqual(typeof manager.run, 'function');
  assert.strictEqual(typeof manager.parseArguments, 'function');
  assert.strictEqual(typeof manager.showHelp, 'function');
});

test('parseArguments handles basic commands', () => {
  const manager = new DevServerManager();

  // Mock process.argv
  const originalArgv = process.argv;

  try {
    process.argv = ['node', 'script.js', 'start', 'frontend'];
    const result = manager.parseArguments();
    assert.strictEqual(result.command, 'start');
    assert.strictEqual(result.serverName, 'frontend');
    assert.strictEqual(result.logViewer, null);
  } finally {
    process.argv = originalArgv;
  }
});

test('parseArguments handles log viewer option', () => {
  const manager = new DevServerManager();

  const originalArgv = process.argv;

  try {
    process.argv = ['node', 'script.js', 'start', '--log-viewer', 'bat -f', 'frontend'];
    const result = manager.parseArguments();
    assert.strictEqual(result.command, 'start');
    assert.strictEqual(result.serverName, 'frontend');
    assert.strictEqual(result.logViewer, 'bat -f');
  } finally {
    process.argv = originalArgv;
  }
});

test('getLogViewerCommand priority', () => {
  const manager = new DevServerManager();

  // CLI argument takes priority
  assert.strictEqual(manager.getLogViewerCommand('cli-cmd'), 'cli-cmd');

  // Environment variable as fallback
  const originalEnv = process.env.DEV_LOG_VIEWER;
  process.env.DEV_LOG_VIEWER = 'env-cmd';
  assert.strictEqual(manager.getLogViewerCommand(null), 'env-cmd');

  // Default fallback
  delete process.env.DEV_LOG_VIEWER;
  assert.strictEqual(manager.getLogViewerCommand(null), 'tail -f');

  // Restore environment
  if (originalEnv) {
    process.env.DEV_LOG_VIEWER = originalEnv;
  }
});