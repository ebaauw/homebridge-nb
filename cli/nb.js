#!/usr/bin/env node

// nb.js
//
// Homebridge NB Tools.
// Copyright © 2018-2026 Erik Baauw. All rights reserved.

import { NbTool } from 'hb-nb-tools/NbTool'

import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const packageJson = require('../package.json')
// import packageJson from '../package.json' with { type: 'json' }

new NbTool(packageJson).main()
