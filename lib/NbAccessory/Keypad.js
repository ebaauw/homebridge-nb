// homebridge-nb/lib/NbAccessory/Keypad.js
// Copyright © 2020-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const NbAccessory = require('../NbAccessory')

class Keypad extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = 'Keypad'
    super(bridge, {
      id: params.id,
      name: params.device.name + ' Keypad',
      device: params.device,
      category: bridge.Accessory.Categories.PROGRAMMABLE_SWITCH,
      model: 'Keypad'
    })
    this.service = new ServiceDelegate.Dummy(this)
    this.batteryService = new ServiceDelegate.Battery(this, {
      statusLowBattery: params.device.lastKnownState.keypadBatteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    })
  }

  update (state) {
    if (state.doorsensorBatteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.doorsensorBatteryCritical
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

module.exports = Keypad
