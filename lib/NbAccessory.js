// homebridge-nb/lib/NbAccessory.js
// Copyright © 2020 Erik Baauw. All rights reserved.
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

    this.client = new NbClient({
      host: this.context.host,
      token: this.context.token
    })
    this.client.on('request', (id, method, resource) => {
      this.debug('request %d: %s %s', id, method, resource)
    })
    this.client.on('vrequest', (id, method, resource) => {
      this.vdebug('request %d: %s %s', id, method, resource)
    })
    this.client.on('vresponse', (id, response) => {
      this.vdebug('request %d: response: %j', id, response)
    })
    this.client.on('response', (id, statusCode, statusMessage) => {
      this.debug('request %d: %s %s', id, statusCode, statusMessage)
    })
    this.client.on('event', (event) => {
      this.debug('event: %j', event)
      const id = event.nukiId.toString(16).toUpperCase()
      switch (event.deviceType) {
        case NbClient.DeviceTypes.SMARTLOCK:
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

  async init (beat) {
    try {
      await this.client.init()
      this.callbackUrl = await this.platform.addClient(this.client)
      this.log('subscribe to event notifications')
      await this.client.callbackAdd(this.callbackUrl)

      this.initialBeat = beat
      await this.heartbeat(beat)
      this.on('heartbeat', this.heartbeat)

      this.debug('initialised')
      this.emit('initialised')
    } catch (error) {
      this.error(error)
    }
  }

  async shutdown () {
    if (this.client != null) {
      const response = await this.client.callbackList()
      for (const callback of response.body.callbacks) {
        if (callback.url === this.callbackUrl) {
          try {
            this.log('unsubscribe from event notifications')
            await this.client.callbackRemove(callback.id)
          } catch (error) {
            this.error(error)
          }
        }
      }
      this.platform.removeClient(this.client)
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
        let response = await this.client.info()
        this.debug('bridge: %j', response.body)
        this.service.update(response.body)
        response = await this.client.list()
        for (const device of response.body) {
          this.debug('device: %j', device)
          const id = device.nukiId.toString(16).toUpperCase()
          switch (device.deviceType) {
            case NbClient.DeviceTypes.SMARTLOCK:
              if (this.smartLocks[id] == null) {
                this.addSmartLock(id, {
                  id: id,
                  name: device.name + ' Lock',
                  firmware: device.firmwareVersion
                })
              }
              this.smartLocks[id].update(device.lastKnownState)
              if (this.doorSensors[id + '-S'] == null) {
                if (
                  device.lastKnownState.doorsensorState ===
                    NbClient.DoorSensorStates.DEACTIVATED
                ) {
                  break
                }
                this.addDoorSensor(id + '-S', {
                  id: id + '-S',
                  name: device.name + ' Sensor',
                  firmware: device.firmwareVersion
                })
              }
              this.doorSensors[id + '-S'].update(device.lastKnownState)
              break
            case NbClient.DeviceTypes.OPENER:
              if (this.openers[id] == null) {
                this.addOpener(id, {
                  id: id,
                  name: device.name,
                  firmware: device.firmwareVersion
                })
              }
              this.openers[id].update(device.lastKnownState)
              break
            default:
              break
          }
        }
      } catch (error) {
        this.warn(error)
      }
    }
  }
}

class SmartLock extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = 'Smart Lock'
    super(bridge, params)
    this.batteryService = new homebridgeLib.ServiceDelegate.Battery(this)
    this.service = new NbService.SmartLock(this)
    // this.doorService = new NbService.Door(this)
    // this.historyService = new homebridgeLib.ServiceDelegate.History.Contact(
    //   this, { name: this.name },
    //   this.doorService.characteristicDelegate('contact'),
    //   this.doorService.characteristicDelegate('timesOpened'),
    //   this.doorService.characteristicDelegate('lastActivation')
    // )
  }

  update (state) {
    this.service.update(state)
    // this.doorService.update(state)
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
    const response = await this.client.lockState(
      this.id, NbClient.DeviceTypes.SMARTLOCK
    )
    this.update(response.body)
  }
}

class DoorSensor extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR
    params.model = 'Door Sensor'
    super(bridge, params)
    this.doorService = new NbService.Door(this)
    this.historyService = new homebridgeLib.ServiceDelegate.History.Contact(
      this, { name: this.name },
      this.doorService.characteristicDelegate('contact'),
      this.doorService.characteristicDelegate('timesOpened'),
      this.doorService.characteristicDelegate('lastActivation')
    )
  }

  update (state) {
    this.doorService.update(state)
  }

  async identify () {
    const response = await this.client.lockState(
      this.id, NbClient.DeviceTypes.SMARTLOCK
    )
    this.update(response.body)
  }
}

class Opener extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = 'Opener'
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
    const response = await this.client.lockState(
      this.id, NbClient.DeviceTypes.OPENER
    )
    this.update(response.body)
  }
}

module.exports = NbAccessory
