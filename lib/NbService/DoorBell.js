// homebridge-nb/lib/NbService/DoorBell.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

import { NbService } from '../NbService.js'

const { dateToString } = NbService

class DoorBell extends ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.Doorbell
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'programmableSwitchEvent',
      Characteristic: this.Characteristics.hap.ProgrammableSwitchEvent,
      props: {
        minValue: this.Characteristics.hap.ProgrammableSwitchEvent.SINGLE_PRESS,
        maxValue: this.Characteristics.hap.ProgrammableSwitchEvent.SINGLE_PRESS
      }
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated
    })
    this.addCharacteristicDelegate({
      key: 'enabled',
      Characteristic: this.Characteristics.my.Enabled,
      value: true
    })
  }

  update (state) {
    if (state.ringactionTimestamp != null) {
      const lastUpdated = dateToString(state.ringactionTimestamp)
      if (lastUpdated !== this.values.lastUpdated) {
        if (/* state.ringactionState && */ this.values.enabled) {
          this.values.programmableSwitchEvent =
            this.Characteristics.hap.ProgrammableSwitchEvent.SINGLE_PRESS
        }
        this.values.lastUpdated = lastUpdated
      }
    }
  }
}

NbService.DoorBell = DoorBell
