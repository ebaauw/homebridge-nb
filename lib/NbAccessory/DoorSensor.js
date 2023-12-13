// homebridge-nb/lib/NbAccessory/DoorSensor.js
// Copyright © 2020-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const NbAccessory = require('../NbAccessory')
const NbService = require('../NbService')

class DoorSensor extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR
    params.model = 'Door Sensor'
    super(bridge, {
      id: params.id,
      name: params.device.name + ' Sensor',
      device: params.device,
      category: bridge.Accessory.Categories.DOOR,
      model: 'Door Sensor'
    })
    this.service = new NbService.DoorSensor(this)
    if (params.device.deviceType === 4 && params.device.lastKnownState.keypadBatteryCritical) {
      this.batteryService = new ServiceDelegate.Battery(this, {
        statusLowBattery: params.device.lastKnownState.keypadBatteryCritical
          ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
          : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
      })
    }
    this.historyService = new ServiceDelegate.History(this, {
      contactDelegate: this.service.characteristicDelegate('contact'),
      lastContactDelegate: this.service.characteristicDelegate('lastActivation'),
      timesOpenedDelegate: this.service.characteristicDelegate('timesOpened')
    })
  }

  update (state) {
    this.service.update(state)
    if (this.batteryService != null && state.keypadBatteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.keypadBatteryCritical
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

module.exports = DoorSensor
