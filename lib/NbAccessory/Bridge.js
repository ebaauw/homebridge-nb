// homebridge-nb/lib/NbAccessory/Bridge.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { AccessoryDelegate, ServiceDelegate, toHexString } = require('homebridge-lib')
const NbAccessory = require('../NbAccessory')
const NbService = require('../NbService')
const { NbClient } = require('hb-nb-tools')

class Bridge extends AccessoryDelegate {
  constructor (platform, context) {
    super(platform, {
      id: context.id,
      name: context.name,
      category: platform.Accessory.Categories.RANGE_EXTENDER,
      model: 'Bridge',
      firmware: context.firmware
    })
    this.id = context.id
    this.context.host = context.host
    this.context.token = context.token
    this.context.firmware = context.firmware
    this.log(
      'Nuki Bridge v%s %s at %s', context.firmware, context.id, context.host
    )
    this.on('shutdown', this.shutdown)
    this.heartbeatEnabled = true
    this.once('heartbeat', this.init)

    this.smartLocks = {}
    this.doorSensors = {}
    this.keypads = {}
    this.openers = {}
    this.service = new NbService.Bridge(this)
    this.manageLogLevel(this.service.characteristicDelegate('logLevel'))
    this.dummyService = new ServiceDelegate.Dummy(this)

    this.client = new NbClient({
      host: this.context.host,
      timeout: platform.config.timeout,
      token: this.context.token
    })
    this.client
      .on('error', (error) => {
        this.log(
          'request %d: %s %s', error.request.id,
          error.request.method, error.request.resource
        )
        this.warn('request %d: error: %s', error.request.id, error)
      })
      .on('request', (request) => {
        this.debug(
          'request %d: %s %s', request.id, request.method, request.resource
        )
        this.vdebug(
          'request %d: %s %s', request.id, request.method, request.url
        )
      })
      .on('response', (response) => {
        this.vdebug(
          'request %d: response: %j', response.request.id, response.body
        )
        this.debug(
          'request %d: %s %s', response.request.id,
          response.statusCode, response.statusMessage
        )
      })
      .on('event', (event) => {
        this.debug('event: %j', event)
        const id = toHexString(event.nukiId)
        switch (event.deviceType) {
          case NbClient.DeviceTypes.SMARTLOCK:
          case NbClient.DeviceTypes.SMARTDOOR:
          case NbClient.DeviceTypes.SMARTLOCK3:
            if (this.smartLocks[id] != null) {
              this.smartLocks[id].update(event)
            }
            if (this.doorSensors[id + '-S'] != null) {
              this.doorSensors[id + '-S'].update(event)
            }
            break
          case NbClient.DeviceTypes.OPENER:
            if (this.openers[id] != null) {
              this.openers[id].update(event)
            }
            break
          default:
            break
        }
      })
  }

  get host () { return this.context.host }
  set host (value) {
    if (value !== this.context.host) {
      this.debug('now at %s', value)
      this.client.host = value
      this.context.host = value
      this.once('heartbeat', this.init)
    }
  }

  async init (beat) {
    try {
      await this.client.init()
      this.values.firmware = this.client.firmware
      this.context.firmware = this.values.firmware
      if (this.values.firmware !== this.platform.packageJson.engines.nuki) {
        this.warn(
          'recommended version: Nuki Bridge v%s',
          this.platform.packageJson.engines.nuki
        )
      }
      switch (this.client.encryption) {
        case 'none':
          this.warn('using plain-text tokens')
          break
        case 'hashedToken':
          this.warn('using deprecated hashed tokens')
          break
        default:
          break
      }
    } catch (error) {
      return
    }
    if (this.context.callbackUrl) {
      this.warn('unclean shutdown - checking for stale subscriptions')
      try {
        const response = await this.client.callbackList()
        for (const callback of response.body.callbacks) {
          if (callback.url === this.context.callbackUrl) {
            this.log('remove stale subscription')
            await this.client.callbackRemove(callback.id)
          }
        }
      } catch (error) {
        this.warn(error)
      }
    }
    this.context.callbackUrl = await this.platform.addClient(this.client)
    this.initialBeat = beat
    try {
      await this.heartbeat(beat)
    } catch (error) {}
    this.on('heartbeat', this.heartbeat)
    this.debug('initialised')
    this.emit('initialised')
  }

  async checkSubscription () {
    if (this.callbackId == null) {
      this.log('subscribe to event notifications')
      const response = await this.client.callbackAdd(this.context.callbackUrl)
      if (!response.body.success) {
        this.error(response.body.message)
        return
      }
    }
    const response = await this.client.callbackList()
    for (const callback of response.body.callbacks) {
      if (callback.url === this.context.callbackUrl) {
        this.debug('subscription: %j', callback)
        this.callbackId = callback.id
        return
      }
    }
    if (this.callbackId != null) {
      this.warn('lost subscription to event notifications')
      this.callbackId = null
    }
    return this.checkSubscription()
  }

  async shutdown () {
    if (this.client != null) {
      const response = await this.client.callbackList()
      for (const callback of response.body.callbacks) {
        if (callback.url === this.context.callbackUrl) {
          try {
            this.log('unsubscribe from event notifications')
            await this.client.callbackRemove(callback.id)
            delete this.context.callbackUrl
          } catch (error) {
            this.error(error)
          }
        }
      }
      this.platform.removeClient(this.client)
    }
  }

  addDoorSensor (id, context) {
    this.doorSensors[id] = new NbAccessory.DoorSensor(this, context)
  }

  addKeypad (id, context) {
    this.keypads[id] = new NbAccessory.Keypad(this, context)
  }

  addOpener (id, context) {
    this.openers[id] = new NbAccessory.Opener(this, context)
  }

  addSmartLock (id, context) {
    this.smartLocks[id] = new NbAccessory.SmartLock(this, context)
  }

  checkDoorSensor (id, device) {
    if (
      device.lastKnownState.doorsensorState != null &&
      device.lastKnownState.doorsensorState !== NbClient.DoorSensorStates.DEACTIVATED
    ) {
      if (this.doorSensors[id] == null) {
        this.addDoorSensor(id, { id, device })
      }
      this.doorSensors[id].context.device = device
      this.doorSensors[id].update(device.lastKnownState)
    } else if (this.doorSensors[id] != null) {
      this.doorSensors[id].destroy()
      delete this.doorSensors[id]
    }
  }

  checkKeypad (id, device) {
    if (
      device.lastKnownState.keypadBatteryCritical != null && (
        device.deviceType !== 4 || device.lastKnownState.doorsensorState == null
      )
    ) {
      if (this.keypads[id] == null) {
        this.addKeypad(id, { id, device })
      }
      this.keypads[id].context.device = device
      this.keypads[id].update(device.lastKnownState)
    } else if (this.keypads[id] != null) {
      this.keypads[id].destroy()
      delete this.keypads[id]
    }
  }

  checkFirmware (info) {
    if (this.values.firmware !== info.versions.firmwareVersion) {
      this.values.firmware = info.versions.firmwareVersion
      this.context.firmware = this.values.firmware
      if (this.values.firmware !== this.platform.packageJson.engines.nuki) {
        this.warn(
          'recommended version: Nuki Bridge v%s',
          this.platform.packageJson.engines.nuki
        )
      }
    }
  }

  async heartbeat (beat) {
    if ((beat - this.initialBeat) % this.service.values.heartrate === 0) {
      try {
        await this.checkSubscription()
        let response = await this.client.info()
        this.debug('bridge: %j', response.body)
        this.checkFirmware(response.body)
        this.service.update(response.body)
        response = await this.client.list()
        for (const device of response.body) {
          try {
            this.debug('device: %j', device)
            if (device.firmwareVersion == null) { // Issue 93.
              continue
            }
            const id = toHexString(device.nukiId)
            if (!this.platform.isWhitelisted(id)) {
              continue
            }
            switch (device.deviceType) {
              case NbClient.DeviceTypes.SMARTLOCK:
              case NbClient.DeviceTypes.SMARTDOOR:
              case NbClient.DeviceTypes.SMARTLOCK3:
                if (device.lastKnownState == null) {
                  this.warn('%s: no last known state', id)
                  continue
                }
                if (device.name == null || device.name === '') {
                  device.name = 'Nuki_' + id
                }
                if (this.smartLocks[id] == null) {
                  this.addSmartLock(id, { id, device })
                }
                this.smartLocks[id].context.device = device
                this.smartLocks[id].update(device.lastKnownState)
                this.checkDoorSensor(id, device)
                this.checkKeypad(id, device)
                break
              case NbClient.DeviceTypes.OPENER:
                if (device.lastKnownState == null) {
                  this.warn('%s: no last known state', id)
                  continue
                }
                if (device.name == null || device.name === '') {
                  device.name = 'Nuki_Opener_' + id
                }
                if (this.openers[id] == null) {
                  this.addOpener(id, { id, device })
                }
                this.openers[id].context.device = device
                this.openers[id].update(device.lastKnownState)
                this.checkKeypad(id, device)
                break
              default:
                break
            }
          } catch (error) {
            this.warn('heartbeat error: %s', error)
          }
        }
        // Workaround: bridge state isn't always updated
        for (const id in this.smartLocks) {
          try {
            if (this.smartLocks[id].service.needRefresh) {
              const response = await this.smartLocks[id].refresh()
              const state = response.body
              this.debug('device state refresh: %j', state)
              this.smartLocks[id].update(state)
            }
          } catch (error) {
            this.warn('heartbeat error: %s', error)
          }
        }
        // End workaround
      } catch (error) {
        this.warn('heartbeat error: %s', error)
      }
    }
  }
}

module.exports = Bridge
