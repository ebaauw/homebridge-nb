// homebridge-nb/lib/NbAccessory/Keypad.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/Battery'
import 'homebridge-lib/ServiceDelegate/Dummy'

import { NbAccessory } from '../NbAccessory.js'

class Keypad extends NbAccessory {
  constructor (bridge, params) {
    params.category = bridge.Accessory.Categories.DOOR_LOCK
    params.model = 'Keypad'
    super(bridge, {
      id: params.id + '-K',
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
    if (state.keypadBatteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.keypadBatteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    }
  }
}

NbAccessory.Keypad = Keypad
