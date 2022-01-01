// homebridge-nb/lib/NbAccessory.js
// Copyright © 2020-2022 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const homebridgeLib = require('homebridge-lib')
const NbService = require('./NbService')
const NbClient = require('./NbClient')

class NbAccessory extends homebridgeLib.AccessoryDelegate {
  constructor (bridge, params) {
    super(bridge.platform, {
      id: params.id,
      name: params.name,
      category: params.category,
      manufacturer: 'Nuki Home Solutions GmbH',
      model: params.model,
      firmware: params.firmware
    })
    this.inheritLogLevel(bridge)
    this.id = params.id
    this.bridge = bridge
    this.client = this.bridge.client
    this.context.bridgeId = this.bridge.id
    this.context.firmware = params.firmware
    this.context.deviceType = params.deviceType
    this.log('Nuki %s v%s %s', params.model, params.firmware, params.id)
    this.on('identify', this.identify)
    setImmediate(() => { this.emit('initialised') })
  }

  static get Bridge () { return Bridge }
  static get SmartLock () { return SmartLock }
  static get DoorSensor () { return DoorSensor }
  static get Opener () { return Opener }
}

class Bridge extends homebridgeLib.AccessoryDelegate {
  constructor (platform, context) {
    const params = {
      id: context.id,
      name: context.name,
      category: platform.Accessory.Categories.RANGE_EXTENDER,
      manufacturer: 'Nuki Home Solutions GmbH',
      model: 'Bridge',
      firmware: context.firmware
    }
    super(platform, params)
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
    this.openers = {}
    this.service = new NbService.Bridge(this)
    this.dummyService = new homebridgeLib.ServiceDelegate.Dummy(this)

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
        const id = event.nukiId.toString(16).toUpperCase()
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
      // TODO firmware version check
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
          } catch (error) {
            this.error(error)
          }
        }
      }
      this.platform.removeClient(this.client)
      delete this.context.callbackUrl
    }
  }

  addSmartLock (id, context) {
    this.smartLocks[id] = new NbAccessory.SmartLock(this, context)
  }

  addDoorSensor (id, context) {
    this.doorSensors[id] = new NbAccessory.DoorSensor(this, context)
  }

  addOpener (id, context) {
    this.openers[id] = new NbAccessory.Opener(this, context)
  }

  async heartbeat (beat) {
    if ((beat - this.initialBeat) % this.service.values.heartrate === 0) {
      try {
        await this.checkSubscription()
        let response = await this.client.info()
        this.debug('bridge: %j', response.body)
        // this.values.firmware = response.body.versions.firmwareVersion
        // this.context.firmware = this.values.firmware
        // TODO firmware check
        this.service.update(response.body)
        response = await this.client.list()
        for (const device of response.body) {
          this.debug('device: %j', device)
          const id = device.nukiId.toString(16).toUpperCase()
          switch (device.deviceType) {
            case NbClient.DeviceTypes.SMARTLOCK:
            case NbClient.DeviceTypes.SMARTDOOR:
            case NbClient.DeviceTypes.SMARTLOCK3:
              if (this.smartLocks[id] == null) {
                this.addSmartLock(id, {
                  id: id,
                  name: device.name,
                  firmware: device.firmwareVersion,
                  deviceType: device.deviceType
                })
              }
              this.smartLocks[id].values.firmware = device.firmwareVersion
              this.smartLocks[id].context.deviceType = device.deviceType
              this.smartLocks[id].update(device.lastKnownState)
              if (
                device.lastKnownState.doorsensorState != null &&
                device.lastKnownState.doorsensorState !== NbClient.DoorSensorStates.DEACTIVATED
              ) {
                if (this.doorSensors[id + '-S'] == null) {
                  this.addDoorSensor(id + '-S', {
                    id: id + '-S',
                    name: device.name + ' Sensor',
                    firmware: device.firmwareVersion,
                    deviceType: device.deviceType
                  })
                }
                this.doorSensors[id + '-S'].values.firmware = device.firmwareVersion
                this.doorSensors[id + '-S'].context.deviceType = device.deviceType
                this.doorSensors[id + '-S'].update(device.lastKnownState)
              } else if (this.doorSensors[id + '-S'] != null) {
                this.doorSensors[id + '-S'].destroy()
                delete this.doorSensors[id + '-S']
              }
              break
            case NbClient.DeviceTypes.OPENER:
              if (this.openers[id] == null) {
                this.addOpener(id, {
                  id: id,
                  name: device.name,
                  firmware: device.firmwareVersion,
                  deviceType: device.deviceType
                })
              }
              this.openers[id].values.firmware = device.firmwareVersion
              this.openers[id].context.deviceType = device.deviceType
              this.openers[id].update(device.lastKnownState)
              break
            default:
              break
          }
        }
      } catch (error) {
        this.warn('heartbeat error: %s', error)
      }
    }
  }
}

class SmartLock extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = NbClient.modelName(params.deviceType, params.firmware)
    super(bridge, params)
    this.context.deviceType = params.firmware
    this.batteryService = new homebridgeLib.ServiceDelegate.Battery(this)
    this.service = new NbService.SmartLock(this)
    if (this.platform.config.latch) {
      this.latchService = new NbService.Latch(this)
    }
  }

  update (state) {
    this.service.update(state)
    if (this.platform.config.latch) {
      this.latchService.update(state)
    }
    if (state.batteryChargeState) {
      this.batteryService.values.batteryLevel = state.batteryChargeState
    }
    if (state.batteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.batteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    }
  }

  async identify () {
    try {
      const response = await this.client.lockState(
        this.id, this.context.deviceType
      )
      this.update(response.body)
    } catch (error) { this.error(error) }
  }
}

class DoorSensor extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR
    params.model = 'Door Sensor'
    super(bridge, params)
    this.service = new NbService.DoorSensor(this)
    this.historyService = new homebridgeLib.ServiceDelegate.History.Contact(
      this, { name: this.name },
      this.service.characteristicDelegate('contact'),
      this.service.characteristicDelegate('timesOpened'),
      this.service.characteristicDelegate('lastActivation')
    )
  }

  update (state) {
    this.service.update(state)
  }

  async identify () {
    try {
      const response = await this.client.lockState(
        this.id, this.context.deviceType
      )
      this.update(response.body)
    } catch (error) { this.error(error) }
  }
}

class Opener extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = NbClient.modelName(params.deviceType, params.firmware)
    super(bridge, params)
    this.batteryService = new homebridgeLib.ServiceDelegate.Battery(this)
    this.doorBellService = new NbService.DoorBell(this)
    this.openerService = new NbService.Opener(this)
  }

  update (state) {
    this.doorBellService.update(state)
    this.openerService.update(state)
    if (state.batteryCritical != null) {
      if (state.batteryCritical) {
        this.batteryService.values.statusLowBattery =
          this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        this.batteryService.values.batteryLevel = 10
      } else {
        this.batteryService.values.statusLowBattery =
          this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
        this.batteryService.values.batteryLevel = 90
      }
    }
  }

  async identify () {
    try {
      const response = await this.client.lockState(
        this.id, NbClient.DeviceTypes.OPENER
      )
      this.update(response.body)
    } catch (error) { this.error(error) }
  }
}

module.exports = NbAccessory
