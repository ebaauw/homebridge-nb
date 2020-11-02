// homebridge-nb/lib/NbDiscovery.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const homebridgeLib = require('homebridge-lib')

class NbDiscovery {
  constructor (options = {}) {
    this.options = {
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this._options)
    optionParser.stringKey('host', true)
    optionParser.intKey('timeout', 1, 60)
    optionParser.stringKey('token')
    optionParser.parse(options)
  }

  async discover () {
    const options = {
      https: true,
      host: 'api.nuki.io',
      json: true,
      keepAlive: false,
      path: '/discover',
      timeout: this.options.timeout
    }
    const client = new homebridgeLib.HttpClient(options)
    const response = await client.request('GET', '/bridges')
    return response.body.bridges
  }
}

module.exports = NbDiscovery
