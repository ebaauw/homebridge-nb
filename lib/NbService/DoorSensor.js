// homebridge-nb/lib/NbService/DoorSensor.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const { NbClient } = require('hb-nb-tools')
const { dateToString } = require('../NbService')

class DoorSensor extends ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.ContactSensor
    params.primaryService = true
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'contact',
      Characteristic: this.Characteristics.hap.ContactSensorState
    })
    this.addCharacteristicDelegate({
      key: 'timesOpened',
      Characteristic: this.Characteristics.eve.TimesOpened,
      value: 0
      // silent: true
    })
    this.addCharacteristicDelegate({
      key: 'lastActivation',
      Characteristic: this.Characteristics.eve.LastActivation
      // silent: true
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault,
      value: this.Characteristics.hap.StatusFault.NO_FAULT
    })
  }

  update (state) {
    if (state.doorsensorState != null) {
      switch (state.doorsensorState) {
        case NbClient.DoorSensorStates.CLOSED:
          this.values.contact = this.Characteristics.hap.ContactSensorState.CONTACT_DETECTED
          this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
          break
        case NbClient.DoorSensorStates.OPEN:
          this.values.contact = this.Characteristics.hap.ContactSensorState.CONTACT_NOT_DETECTED
          this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
          break
        default:
          this.values.contact = this.Characteristics.hap.ContactSensorState.CONTACT_DETECTED
          this.values.statusFault = this.Characteristics.hap.StatusFault.GENERAL_FAULT
          break
      }
    }
    if (state.timestamp != null) {
      this.values.lastUpdated = dateToString(state.timestamp)
    }
  }
}

module.exports = DoorSensor
