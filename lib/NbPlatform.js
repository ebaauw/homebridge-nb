// homebridge-nb/lib/NbPlatform.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const NbAccessory = require('./NbAccessory')
const NbClient = require('./NbClient')
const NbDiscovery = require('./NbDiscovery')
const NbListener = require('./NbListener')

class NbPlatform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.config = {
      timeout: 15
    }
    const optionParser = new homebridgeLib.OptionParser(this.config, true)
    optionParser
      .stringKey('name')
      .stringKey('platform')
      .boolKey('latch')
      .intKey('timeout', 1, 60) // seconds
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
    try {
      optionParser.parse(configJson)
      this.bridges = {}
      this.discovery = new NbDiscovery({
        timeout: this.config.timeout
      })
      this.discovery
        .on('error', (error, id, method, resource, body, url) => {
          this.warn('nuki server: request %d: %s %s', id, method, resource)
          this.warn('nuki server: request %d: error: %s', id, error)
        })
        .on('request', (id, method, resource, body, url) => {
          this.debug('nuki server: request %d: %s %s', id, method, resource)
          this.vdebug('nuki server: request %d: %s %s', id, method, url)
        })
        .on('response', (id, code, message, body) => {
          this.vdebug('nuki server: request %d: response: %j', id, body)
          this.debug('nuki server: request %d: %d %s', id, code, message)
        })
      this
        .on('accessoryRestored', this.accessoryRestored)
        .once('heartbeat', this.init)
    } catch (error) {
      this.error(error)
    }
    this.debug('config: %j', this.config)
  }

  async init (beat) {
    try {
      if (Object.keys(this.bridges).length === 0) {
        const jobs = []
        const bridges = await this.discovery.discover()
        this.debug('discovery: %j', bridges)
        for (const bridge of bridges) {
          jobs.push(this.foundBridge(bridge))
        }
        for (const job of jobs) {
          try {
            await job
          } catch (error) {
            this.warn(error)
          }
        }
      }
    } catch (error) {
      this.warn(error)
    }
    this.on('heartbeat', this.heartbeat)
    this.debug('initialised')
    this.emit('initialised')
  }

  async heartbeat (beat) {
    if (beat % 600 === 0) {
      const bridges = await this.discovery.discover()
      this.debug('discovery: %j', bridges)
      const jobs = []
      for (const bridge of bridges) {
        jobs.push(this.foundBridge(bridge))
      }
      for (const job of jobs) {
        try {
          await job
        } catch (error) {
          this.warn(error)
        }
      }
    }
  }

  async foundBridge (bridge) {
    if (bridge.ip == null || bridge.port == null) {
      return
    }
    const id = bridge.bridgeId.toString(16).toUpperCase()
    const host = bridge.ip + ':' + bridge.port
    if (this.bridges[id] == null) {
      const name = 'Bridge_' + id
      this.debug('%s: found bridge %s at %s', name, id, host)
      const client = new NbClient({
        host: host,
        timeout: 30
      })
      client
        .on('error', (error) => {
          this.log(
            '%s: request %d: %s %s', name, error.request.id,
            error.request.method, error.request.resource
          )
          this.warn(
            '%s: request %d: error: %s', name, error.request.id, error
          )
        })
        .on('request', (request) => {
          this.debug(
            '%s: request %d: %s %s', name, request.id,
            request.method, request.resource
          )
          this.vdebug(
            '%s: equest %d: %s %s', name, request.id,
            request.method, request.url
          )
        })
        .on('response', (response) => {
          this.vdebug(
            '%s: request %d: response: %j', name, response.request.id,
            response.body
          )
          this.debug(
            '%s: request %d: %s %s', name, response.request.id,
            response.statusCode, response.statusMessage
          )
        })
      while (client.token == null) {
        try {
          this.log('%s: press Nuki bridge button to obtain token', name)
          await client.auth()
        } catch (error) {
          this.warn(error)
        }
      }
      await client.init()
      this.bridges[client.id] = new NbAccessory.Bridge(this, {
        id: client.id,
        name: client.name,
        firmware: client.firmware,
        // host: client.host,
        host: host, // FIXME: bug in homebridge-lib@4.8.2
        token: client.token
      })
      await events.once(this.bridges[client.id], 'initialised')
    } else {
      this.bridges[id].host = host
    }
  }

  accessoryRestored (className, version, id, name, context) {
    switch (className) {
      case 'Bridge':
        context.id = id
        context.name = name
        this.bridges[id] = new NbAccessory.Bridge(this, context)
        break
      case 'SmartLock':
      case 'DoorSensor':
      case 'Opener':
        {
          const bridge = this.bridges[context.bridgeId]
          if (bridge == null) {
            this.warn(
              '%s: ignore %s accessory for unknown bridge %s', name, className,
              context.bridgeId
            )
            break
          }
          context.id = id
          context.name = name
          bridge['add' + className](context.id, context)
        }
        break
      default:
        this.warn(
          '%s: ignore unknown %s %v accesssory', name, className, version
        )
        break
    }
  }

  async addClient (client) {
    if (this.listener == null) {
      this.listener = new NbListener()
      this.listener
        .on('error', (error) => { this.error(error) })
        .on('listening', (url) => {
          this.log('listening on %s', url)
        })
        .on('close', (url) => {
          this.log('closed %s', url)
        })
    }
    return this.listener.addClient(client)
  }

  removeClient (client) {
    if (this.listener != null) {
      this.listener.removeClient(client)
    }
  }
}

module.exports = NbPlatform
