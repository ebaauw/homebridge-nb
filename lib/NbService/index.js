// homebridge-nb/lib/NbService/index.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')

class NbService extends ServiceDelegate {
  static get Bridge () { return require('./Bridge') }
  static get DoorBell () { return require('./DoorBell') }
  static get DoorSensor () { return require('./DoorSensor') }
  static get Latch () { return require('./Latch') }
  static get Opener () { return require('./Opener') }
  static get SmartLock () { return require('./SmartLock') }

  static dateToString (date) {
    if (date == null) {
      return String(new Date()).slice(0, 24)
    }
    return String(new Date(date)).slice(0, 24)
  }
}

module.exports = NbService
