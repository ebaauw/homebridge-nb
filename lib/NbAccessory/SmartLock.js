// homebridge-nb/lib/NbAccessory/SmartLock.js
// Copyright © 2020-2025 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/Battery'

import { NbClient } from 'hb-nb-tools/NbClient'

import { NbAccessory } from '../NbAccessory.js'
import { NbService } from '../NbService.js'
import '../NbService/Latch.js'
import '../NbService/SmartLock.js'

class SmartLock extends NbAccessory {
  constructor (bridge, params) {
    super(bridge, {
      id: params.id,
      name: params.device.name,
      device: params.device,
      category: bridge.Accessory.Categories.DOOR_LOCK,
      model: NbClient.modelName(params.device.deviceType, params.device.firmwareVersion)
    })
    this.service = new NbService.SmartLock(this)
    if (this.platform.config.latch) {
      // TODO: only import NbService.Latch when config.latch is set
      this.latchService = new NbService.Latch(this)
    }
    this.batteryService = new ServiceDelegate.Battery(this, {
      batteryLevel: params.device.lastKnownState.batteryChargeState,
      chargingState: params.device.lastKnownState.batteryCharging
        ? this.Characteristics.hap.ChargingState.CHARGING
        : this.Characteristics.hap.ChargingState.NOT_CHARGING,
      statusLowBattery: params.device.lastKnownState.batteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    })
  }

  update (state) {
    this.service.update(state)
    if (this.platform.config.latch) {
      this.latchService.update(state)
    }
    if (state.batteryChargeState) {
      this.batteryService.values.batteryLevel = state.batteryChargeState
    }
    if (state.batteryCharging != null) {
      this.batteryService.values.chargingState = state.batteryCharging
        ? this.Characteristics.hap.ChargingState.CHARGING
        : this.Characteristics.hap.ChargingState.NOT_CHARGING
    }
    if (state.batteryCritical != null) {
      this.batteryService.values.statusLowBattery = state.batteryCritical
        ? this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_LOW
        : this.Characteristics.hap.StatusLowBattery.BATTERY_LEVEL_NORMAL
    }
  }
}

NbAccessory.SmartLock = SmartLock
