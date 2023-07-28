// homebridge-nb/lib/NbAccessory/Opener.js
// Copyright © 2020-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const NbAccessory = require('../NbAccessory')
const NbService = require('../NbService')
const { NbClient } = require('hb-nb-tools')

class Opener extends NbAccessory {
  constructor (bridge, params) {
    super(bridge, {
      id: params.id,
      name: params.device.name,
      device: params.device,
      category: bridge.Accessory.Categories.DOOR_LOCK,
      model: NbClient.modelName(params.device.deviceType, params.device.firmwareVersion)
    })
    this.openerService = new NbService.Opener(this)
    this.doorBellService = new NbService.DoorBell(this)
    this.batteryService = new ServiceDelegate.Battery(this, {
      statusLowBattery: params.device.lastKnownState.doorsensorBatteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    })
  }

  update (state) {
    this.openerService.update(state)
    this.doorBellService.update(state)
    if (state.batteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.batteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
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

module.exports = Opener
