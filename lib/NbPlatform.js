// homebridge-nb/lib/NbPlatform.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { once } from 'node:events'

import { timeout, toHexString } from 'homebridge-lib'
import { HttpClient } from 'homebridge-lib/HttpClient'
import { OptionParser } from 'homebridge-lib/OptionParser'
import { Platform } from 'homebridge-lib/Platform'

import { NbClient } from 'hb-nb-tools/NbClient'
import { NbDiscovery } from 'hb-nb-tools/NbDiscovery'
import { NbListener } from 'hb-nb-tools/NbListener'

import { NbAccessory } from './NbAccessory.js'
import './NbAccessory/Bridge.js'

const discoveryInterval = 600

class NbPlatform extends Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.config = {
      devices: [],
      encryption: 'encryptedToken',
      openerResetTimeout: 500,
      timeout: 15
    }
    const optionParser = new OptionParser(this.config, true)
    optionParser
      .stringKey('platform')
      .stringKey('name')
      .arrayKey('devices')
      .enumKey('encryption')
      .enumKeyValue('encryption', 'none')
      .enumKeyValue('encryption', 'hashedToken')
      .enumKeyValue('encryption', 'encryptedToken')
      .boolKey('latch')
      .intKey('port', 0, 65535)
      .intKey('openerResetTimeout', 0, 2000) // milliseconds
      .boolKey('removeStaleAccessories')
      .intKey('timeout', 1, 60) // seconds
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
    try {
      optionParser.parse(configJson)
      const validDevices = []
      for (const i in this.config.devices) {
        try {
          const device = OptionParser.toInt(
            `devices[${i}]`, this.config.devices[i], 0x10000000, 0xFFFFFFFF, true
          )
          validDevices.push(toHexString(device))
        } catch (error) {
          if (error instanceof OptionParser.UserInputError) {
            this.warn(error)
          } else {
            this.error(error)
          }
        }
      }
      this.config.devices = validDevices
      this.bridges = {}
      this.discovery = new NbDiscovery({
        timeout: this.config.timeout
      })
      this.discovery
        .on('error', (error) => {
          this.warn(
            '%s: request %d: %s %s', error.request.name, error.request.id,
            error.request.method, error.request.resource
          )
          this.warn(
            '%s: request %d: error: %s', error.request.name, error.request.id, error
          )
        })
        .on('request', (request) => {
          this.debug(
            '%s: request %d: %s %s', request.name, request.id,
            request.method, request.resource
          )
          this.vdebug(
            '%s: request %d: %s %s', request.name, request.id,
            request.method, request.url
          )
        })
        .on('response', (response) => {
          this.vdebug(
            '%s: request %d: response: %j', response.request.name, response.request.id,
            response.body
          )
          this.debug(
            '%s: request %d: %d %s', response.request.name, response.request.id,
            response.statusCode, response.statusMessage
          )
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
      const jobs = []
      for (const id in this.bridges) {
        jobs.push(once(this.bridges[id], 'initialised'))
      }
      if (jobs.length === 0) {
        jobs.push(this.discover())
      }
      for (const job of jobs) {
        try {
          await job
        } catch (error) {
          if (!(error instanceof HttpClient.HttpError)) {
            this.error(error)
          }
        }
      }
    } catch (error) {
      if (!(error instanceof HttpClient.HttpError)) {
        this.error(error)
      }
    }
    this.on('heartbeat', this.heartbeat)
    this.debug('initialised')
    this.emit('initialised')
  }

  async discover () {
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
        if (!(error instanceof HttpClient.HttpError)) {
          this.error(error)
        }
      }
    }
  }

  async heartbeat (beat) {
    if (beat % discoveryInterval === discoveryInterval - 5) {
      try {
        await this.discover()
      } catch (error) {
        if (!(error instanceof HttpClient.HttpError)) {
          this.error(error)
        }
      }
    }
  }

  isWhitelisted (id) {
    return this.config.devices.length === 0 || this.config.devices.includes(id)
  }

  async foundBridge (bridge) {
    if (bridge.ip == null || bridge.port == null) {
      return
    }
    const id = toHexString(bridge.bridgeId)
    if (!this.isWhitelisted(id)) {
      return
    }
    const host = bridge.ip + ':' + bridge.port
    if (this.bridges[id] == null) {
      const name = 'Nuki Bridge ' + id
      this.debug('%s: found bridge %s at %s', name, id, host)
      const client = new NbClient({
        encryption: this.config.encryption,
        host,
        timeout: 60
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
          if (client.token == null) {
            this.warn('Nuki bridge button not pressed')
          }
        } catch (error) {
          this.warn(error)
          await timeout(30000)
        }
      }
      await client.init()
      this.bridges[client.id] = new NbAccessory.Bridge(this, {
        id: client.id,
        name: client.name,
        firmware: client.firmware,
        host: client.host,
        token: client.token
      })
      await once(this.bridges[client.id], 'initialised')
    } else {
      this.bridges[id].host = host
    }
  }

  accessoryRestored (className, version, id, name, context) {
    id = id.split('-')[0]
    if (!this.isWhitelisted(id)) {
      return
    }
    switch (className) {
      case 'Bridge':
        {
          context.id = id
          // Dirty hack en lieu of patching cachedAccessories
          let needPatch = false
          if (name.startsWith('Nuki_Bridge_')) {
            name = name.replace(/_/g, ' ')
            needPatch = true
          }
          // End hack
          context.name = name
          this.bridges[id] = new NbAccessory.Bridge(this, context)
          // Dirty hack en lieu of patching cachedAccessories
          if (needPatch) {
            this.bridges[id]._accessory._associatedHAPAccessory.displayName = name
            this.bridges[id]._context.name = name
            this.bridges[id].service.values.configuredName = name
            this.bridges[id].dummyService.values.configuredName = name
          }
          // End hack
        }
        break
      case 'SmartLock':
      case 'DoorSensor':
      case 'Keypad':
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
          if (context.device == null) {
            // Old plugin version - re-create accessory delegate on bridge initialisation
            break
          }
          if (this.config.removeStaleAccessories) {
            break
          }
          context.id = id
          context.name = name
          bridge['add' + className](context.id, context)
        }
        break
      default:
        this.warn(
          '%s: ignore unknown %s v%s accesssory', name, className, version
        )
        break
    }
  }

  async addClient (client) {
    if (this.listener == null) {
      this.listener = new NbListener(this.config.port)
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

export { NbPlatform }
