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
      name: 'nuki server',
      path: '/discover',
      timeout: config.timeout
    })
    this.config = config
  }

  async discover () {
    const bridges = []
    const response = await super.get('/bridges')
    if (response == null) {
      return bridges
    }
    for (const bridge of response.body.bridges) {
      const client = new homebridgeLib.HttpClient({
        host: bridge.ip + ':' + bridge.port,
        path: '',
        timeout: this.config.timeout,
        validStatusCodes: [200, 401]
      })
      client
        .on('error', (error) => { this.emit('error', error) })
        .on('request', (request) => { this.emit('request', request) })
        .on('response', (response) => { this.emit('response', response) })
      try {
        await client.get('/info')
        bridges.push(bridge)
      } catch (error) {}
    }
    return bridges
  }
}

module.exports = NbDiscovery
