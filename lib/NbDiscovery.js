// homebridge-nb/lib/NbDiscovery.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const homebridgeLib = require('homebridge-lib')

class NbDiscovery extends homebridgeLib.HttpClient {
  constructor (params = {}) {
    const config = {
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(config)
    optionParser.intKey('timeout', 1, 60)
    optionParser.parse(params)
    super({
      https: true,
      host: 'api.nuki.io',
      json: true,
      keepAlive: false,
      path: '/discover',
      timeout: config.timeout
    })
  }

  async discover () {
    const response = await super.get('/bridges')
    if (response == null) {
      return []
    }
    return response.body.bridges
  }
}

module.exports = NbDiscovery
