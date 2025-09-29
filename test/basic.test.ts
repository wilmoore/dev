import { test } from 'node:test';
import assert from 'node:assert';

// Mock console.log globally to suppress all output during tests
const originalLog = console.log;
const originalError = console.error;
console.log = () => {}; // Suppress all output
console.error = () => {}; // Suppress all errors

test('dev function exists', async () => {
  const { dev } = await import('../dist/index.js');
  assert.ok(dev);
  assert.strictEqual(typeof dev, 'function');
});

test('dev function is async', async () => {
  const { dev } = await import('../dist/index.js');
  assert.strictEqual(typeof dev, 'function');
  
  const { originalArgv, originalExit } = mockArgv([]);
  try {
    const promiseResult = dev(); // Get the promise
    assert.ok(promiseResult instanceof Promise, 'dev should return a Promise');
    await promiseResult; // Await the promise to ensure completion
    assert.fail('dev should have exited with an error'); // Should not reach here
  } catch (e) {
    assert.ok(e.message.includes('process.exit'), 'Expected process.exit error');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
  }
});

// Mock process.argv for argument parsing tests
const mockArgv = (args: string[]) => {
  const originalArgv = process.argv;
  const originalExit = process.exit; // Save original process.exit
  process.argv = ['node', 'script.js', ...args];
  process.exit = (code?: number) => { throw new Error(`process.exit(${code})`); }; // Mock process.exit
  return { originalArgv, originalExit }; // Return both
};

test('dev handles help command', async () => {
  const { dev } = await import('../dist/index.js');
  const { originalArgv, originalExit } = mockArgv(['help']);
  
  try {
    await dev();
    // Help command should complete without throwing
    assert.ok(true, 'Help command completed successfully');
  } catch (e) {
    // Help command should not throw
    assert.fail('Help command should not throw an error');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit; // Restore process.exit
  }
});

test('dev handles status command', async () => {
  const { dev } = await import('../dist/index.js');
  const { originalArgv, originalExit } = mockArgv(['status']);
  
  try {
    await dev();
    // Status command should complete without throwing
    assert.ok(true, 'Status command completed successfully');
  } catch (e) {
    // Status command should not throw
    assert.fail('Status command should not throw an error');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit; // Restore process.exit
  }
});

test('dev handles port command', async () => {
  const { dev } = await import('../dist/index.js');
  const { originalArgv, originalExit } = mockArgv(['port']);
  
  try {
    await dev();
    // Port command should complete without throwing
    assert.ok(true, 'Port command completed successfully');
  } catch (e) {
    // Port command should not throw
    assert.fail('Port command should not throw an error');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit; // Restore process.exit
  }
});

test('dev handles cleanup command', async () => {
  const { dev } = await import('../dist/index.js');
  const { originalArgv, originalExit } = mockArgv(['cleanup']);
  
  try {
    await dev();
    // Cleanup command should complete without throwing
    assert.ok(true, 'Cleanup command handled properly');
  } catch (e) {
    // Cleanup command should not throw
    assert.fail('Cleanup command should not throw an error');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit; // Restore process.exit
  }
});

test('dev handles init command', async () => {
  const { dev } = await import('../dist/index.js');
  const { originalArgv, originalExit } = mockArgv(['init']); // Call mockArgv
  
  try {
    try {
      await dev();
    } catch (e) {
      // Expected to throw due to mocked process.exit or existing .dev directory
      assert.ok(e.message.includes('process.exit') || e.message.includes('already exists'));
    }
    
    // Init command should handle errors gracefully
    assert.ok(true, 'Init command handled properly');
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit; // Restore process.exit
  }
});
