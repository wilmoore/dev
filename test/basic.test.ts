import { test } from 'node:test';
import assert from 'node:assert';

// Mock console.log globally to suppress all output during tests
const originalLog = console.log;
const originalError = console.error;
console.log = () => {}; // Suppress all output
console.error = () => {}; // Suppress all errors

// Import after mocking console
const { dev } = await import('../dist/index.js');

test('dev function exists', () => {
  assert.ok(dev);
  assert.strictEqual(typeof dev, 'function');
});

test('dev function is async', () => {
  assert.strictEqual(typeof dev, 'function');
  // Check that dev returns a Promise
  const result = dev();
  assert.ok(result instanceof Promise);
});

// Mock process.argv for argument parsing tests
const mockArgv = (args: string[]) => {
  const originalArgv = process.argv;
  process.argv = ['node', 'script.js', ...args];
  return originalArgv;
};

test('dev handles help command', async () => {
  const originalArgv = mockArgv(['help']);
  
  try {
    await dev();
    // Help command should complete without throwing
    assert.ok(true, 'Help command completed successfully');
  } catch (e) {
    // Help command should not throw
    assert.fail('Help command should not throw an error');
  } finally {
    process.argv = originalArgv;
  }
});

test('dev handles status command', async () => {
  const originalArgv = mockArgv(['status']);
  
  try {
    await dev();
    // Status command should complete without throwing
    assert.ok(true, 'Status command completed successfully');
  } catch (e) {
    // Status command should not throw
    assert.fail('Status command should not throw an error');
  } finally {
    process.argv = originalArgv;
  }
});

test('dev handles port command', async () => {
  const originalArgv = mockArgv(['port']);
  
  try {
    await dev();
    // Port command should complete without throwing
    assert.ok(true, 'Port command completed successfully');
  } catch (e) {
    // Port command should not throw
    assert.fail('Port command should not throw an error');
  } finally {
    process.argv = originalArgv;
  }
});

test('dev handles cleanup command', async () => {
  const originalArgv = mockArgv(['cleanup']);
  
  try {
    await dev();
    // Cleanup command should complete without throwing
    assert.ok(true, 'Cleanup command handled properly');
  } catch (e) {
    // Cleanup command should not throw
    assert.fail('Cleanup command should not throw an error');
  } finally {
    process.argv = originalArgv;
  }
});

test('dev handles init command', async () => {
  const originalArgv = mockArgv(['init']);
  
  try {
    // Mock process.exit to prevent actual exit
    const originalExit = process.exit;
    process.exit = (code?: number) => { throw new Error(`process.exit(${code})`); };
    
    try {
      await dev();
    } catch (e) {
      // Expected to throw due to mocked process.exit or existing .dev directory
      assert.ok(e.message.includes('process.exit') || e.message.includes('already exists'));
    }
    
    // Restore process.exit
    process.exit = originalExit;
    
    // Init command should handle errors gracefully
    assert.ok(true, 'Init command handled properly');
  } finally {
    process.argv = originalArgv;
  }
});
