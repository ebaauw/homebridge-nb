// homebridge-nb/lib/NbAccessory.js
// Copyright © 2020 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const homebridgeLib = require('homebridge-lib')
const NbClient = require('./NbClient')

function dateToString (date) {
  if (date == null) {
    return String(new Date()).slice(0, 24)
  }
  return String(new Date(date)).slice(0, 24)
}

class NbService extends homebridgeLib.ServiceDelegate {
  static get Bridge () { return Bridge }
  static get SmartLock () { return SmartLock }
  static get Door () { return Door }
  static get DoorBell () { return DoorBell }
  static get Opener () { return Opener }
}

class Bridge extends homebridgeLib.ServiceDelegate {
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
      Characteristic: this.Characteristics.my.Restart
    }).on('didSet', (value) => {
      if (value) {
        this.warn('restart: not yet implemented')
        setTimeout(() => {
          this.values.restart = false
        }, 500)
      }
    })
    this.addCharacteristicDelegate({
      key: 'logLevel',
      Characteristic: this.Characteristics.my.LogLevel,
      value: nbAccessory.platform.logLevel
    }).on('didSet', (value) => {
      nbAccessory.logLevel = value
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })
  }

  update (state) {
    try {
      this.values.lastUpdated = dateToString(state.currentTime)
      const bootTime = new Date(state.currentTime).valueOf() - state.uptime * 1000
      this.values.lastBoot = dateToString(new Date(bootTime))
      this.values.statusFault = state.serverConnected && state.wlanConnected
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    } catch (error) {
      this.warn(error)
    }
  }
}

class SmartLock extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.LockMechanism
    params.primaryService = true
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.LockCurrentState
    })
    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.LockTargetState
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (!fromHomeKit) {
          return
        }
        let response
        switch (value) {
          case this.Characteristics.hap.LockTargetState.UNSECURED:
            response = await nbAccessory.client.unlock(
              nbAccessory.id, NbClient.DeviceTypes.SMARTLOCK
            )
            break
          case this.Characteristics.hap.LockTargetState.SECURED:
            response = await nbAccessory.client.lock(
              nbAccessory.id, NbClient.DeviceTypes.SMARTLOCK
            )
            break
          default:
            break
        }
        if (response.body.success) {
          this.values.currentState = value
          nbAccessory.update(response.body.success)
        }
      } catch (error) {
        this.warn(error)
      }
    })
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })
  }

  update (state) {
    try {
      if (state.state != null) {
        switch (state.state) {
          case NbClient.LockStates.UNLOCKED:
          case NbClient.LockStates.UNLATCHED:
          case NbClient.LockStates.UNLOCKED_LOCK_N_GO:
          case NbClient.LockStates.UNLATCHING:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNSECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            break
          case NbClient.LockStates.LOCKING:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNSECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
            break
          case NbClient.LockStates.LOCKED:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
            break
          case NbClient.LockStates.UNLOCKING:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            break
          case NbClient.LockStates.MOTOR_BLOCKED:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.JAMMED
            break
          case NbClient.LockStates.UNDEFINED:
          default:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNKNOWN
            break
        }
      }
      this.values.lastUpdated = dateToString(state.timestamp)
    } catch (error) {
      this.warn(error)
    }
  }
}

class Door extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.ContactSensor
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
      Characteristic: this.Characteristics.hap.StatusFault
    })
  }

  update (state) {
    if (state.doorsensorState) {
      switch (state.doorsensorState) {
        case NbClient.DoorSensorStates.CLOSED:
          this.values.contact = this.Characteristics.hap.ContactSensorState.CONTACT_DETECTED
          break
        case NbClient.DoorSensorStates.OPEN:
          this.values.contact = this.Characteristics.hap.ContactSensorState.CONTACT_NOT_DETECTED
          break
        default:
          break
      }
      this.values.lastUpdated = dateToString(state.timestamp)
    }
  }
}

class DoorBell extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    super(nbAccessory, params)
    this.inheritLogLevel(nbAccessory.bridge)
  }
}

class Opener extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    super(nbAccessory, params)
    this.inheritLogLevel(nbAccessory.bridge)
  }
}

module.exports = NbService
