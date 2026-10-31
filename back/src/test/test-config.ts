import os from 'node:os'
import path from 'node:path'

import type { Config } from '../main/application/config.ts'

export const testConfig: Config = {
  PORT: 0,
  HOST: '127.0.0.1',
  DATA_DIR: path.join(os.tmpdir(), 'printshelf-test'),
  FRONT_DIST: path.join(os.tmpdir(), 'printshelf-test-no-front'),
  DESKTOP: true,
  ALLOWED_HOSTS: [],
  AUTH_USER: 'printshelf',
  AUTH_PASSWORD: '',
}
