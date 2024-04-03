// homebridge-nb/lib/NbAccessory/index.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { AccessoryDelegate, toHexString } = require('homebridge-lib')

class NbAccessory extends AccessoryDelegate {
  static get Bridge () { return require('./Bridge') }
  static get DoorSensor () { return require('./DoorSensor') }
  static get Keypad () { return require('./Keypad') }
  static get Opener () { return require('./Opener') }
  static get SmartLock () { return require('./SmartLock') }

  constructor (bridge, params) {
    super(bridge.platform, {
      id: params.id,
      name: params.name,
      category: params.category,
      manufacturer: 'Nuki',
      model: params.model,
      firmware: params.device.firmwareVersion
    })
    this.inheritLogLevel(bridge)
    this.bridge = bridge
    this.client = this.bridge.client
    this.context.bridgeId = this.bridge.id
    this.nukiId = toHexString(params.device.nukiId)
    this.deviceType = params.device.deviceType
    this.log('Nuki %s v%s %s', params.model, params.device.firmwareVersion, params.id)
    this.on('identify', this.identify)
    setImmediate(() => { this.emit('initialised') })
  }

  async lockAction (action) {
    return this.client.lockAction(this.nukiId, this.deviceType, action)
  }

  async identify () {
    try {
      const response = await this.client.lockState(this.nukiId, this.deviceType)
      this.update(response.body)
    } catch (error) { this.error(error) }
  }
}

module.exports = NbAccessory
