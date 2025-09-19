#!/usr/bin/env node

import { DevServerManager } from '../src/index.js';

const manager = new DevServerManager();
await manager.run();