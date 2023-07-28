// homebridge-nb/lib/NbService/Bridge.js
// Copyright © 2020-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const { dateToString } = require('../NbService')

class Bridge extends ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.my.Resource
    params.primaryService = true
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'heartrate',
      Characteristic: this.Characteristics.my.Heartrate,
      props: { minValue: 10, maxValue: 600, minStep: 10 },
      value: 60
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated
    })
    this.addCharacteristicDelegate({
      key: 'lastBoot',
      Characteristic: this.Characteristics.my.LastBoot
    })
    this.addCharacteristicDelegate({
      key: 'restart',
      Characteristic: this.Characteristics.my.Restart,
      value: false
    }).on('didSet', async (value) => {
      try {
        if (value) {
          await nbAccessory.client.reboot()
          setTimeout(() => {
            this.values.restart = false
          }, 500)
        }
      } catch (error) { this.error(error) }
    })
    this.addCharacteristicDelegate({
      key: 'logLevel',
      Characteristic: this.Characteristics.my.LogLevel,
      value: this.accessoryDelegate.logLevel
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault,
      value: this.Characteristics.hap.StatusFault.NO_FAULT
    })
  }

  update (state) {
    try {
      this.values.lastUpdated = dateToString(state.currentTime)
      const bootTime = new Date(state.currentTime).valueOf() - state.uptime * 1000
      this.values.lastBoot = dateToString(new Date(bootTime))
      this.values.statusFault = state.serverConnected
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    } catch (error) {
      this.warn(error)
    }
  }
}

module.exports = Bridge
