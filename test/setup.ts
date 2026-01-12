import { beforeAll } from 'vitest';

// Disable notifications during tests
beforeAll(() => {
  process.env.ENABLE_NOTIFICATIONS = 'false';
});
