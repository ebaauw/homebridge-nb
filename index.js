// homebridge-nb/index.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { createRequire } from 'node:module'

import { NbPlatform } from './lib/NbPlatform.js'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json')

function main (homebridge) {
  NbPlatform.loadPlatform(homebridge, packageJson, 'NB', NbPlatform)
}

export { main as default }
