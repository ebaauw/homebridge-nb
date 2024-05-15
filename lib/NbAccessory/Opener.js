// homebridge-nb/lib/NbAccessory/Opener.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/Battery'

import { NbClient } from 'hb-nb-tools/NbClient'

import { NbAccessory } from '../NbAccessory.js'
import { NbService } from '../NbService.js'
import '../NbService/DoorBell.js'
import '../NbService/Opener.js'

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
}

NbAccessory.Opener = Opener
