#!/usr/bin/env node

// nb.js
//
// Homebridge NB Tools.
// Copyright © 2018-2023 Erik Baauw. All rights reserved.

'use strict'

const { NbTool } = require('hb-nb-tools')
const pkgJson = require('../package.json')

new NbTool(pkgJson).main()
