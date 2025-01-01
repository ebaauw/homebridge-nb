// homebridge-nb/lib/NbAccessory/DoorSensor.js
// Copyright © 2020-2025 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/Battery'
import 'homebridge-lib/ServiceDelegate/History'

import { NbAccessory } from '../NbAccessory.js'
import { NbService } from '../NbService.js'
import '../NbService/DoorSensor.js'

class DoorSensor extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR
    params.model = 'Door Sensor'
    super(bridge, {
      id: params.id + '-S',
      name: params.device.name + ' Sensor',
      device: params.device,
      category: bridge.Accessory.Categories.DOOR,
      model: 'Door Sensor'
    })
    this.service = new NbService.DoorSensor(this)
    if (
      params.device.deviceType === 4 &&
      params.device.lastKnownState.keypadBatteryCritical != null
    ) {
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
}

NbAccessory.DoorSensor = DoorSensor
