// homebridge-nb/index.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const NbPlatform = require('./lib/NbPlatform')
const packageJson = require('./package.json')

module.exports = (homebridge) => {
  NbPlatform.loadPlatform(homebridge, packageJson, 'NB', NbPlatform)
}
