// homebridge-nb/lib/NbAccessory.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
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
  static get Latch () { return Latch }
  static get DoorSensor () { return DoorSensor }
  static get Opener () { return Opener }
  static get DoorBell () { return DoorBell }
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
      Characteristic: this.Characteristics.my.Restart,
      value: false
    }).on('didSet', async (value) => {
      if (value) {
        await nbAccessory.client.reboot()
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

class SmartLock extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name + ' Lock'
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
      if (!fromHomeKit) {
        return
      }
      const response = await nbAccessory.client.lockAction(
        nbAccessory.id, NbClient.DeviceTypes.SMARTLOCK,
        value === this.Characteristics.hap.LockTargetState.UNSECURED
          ? NbClient.LockActions.UNLOCK
          : NbClient.LockActions.LOCK
      )
      if (response != null && response.body.success) {
        this.values.currentState = value
        nbAccessory.update(response.body)
      }
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
    try {
      if (state.state != null) {
        switch (state.state) {
          case NbClient.LockStates.UNLOCKED:
          case NbClient.LockStates.UNLATCHED:
          case NbClient.LockStates.UNLOCKED_LOCK_N_GO:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNSECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
            break
          case NbClient.LockStates.LOCKING:
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
            this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
            break
          case NbClient.LockStates.LOCKED:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
            this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
            break
          case NbClient.LockStates.UNLOCKING:
          case NbClient.LockStates.UNLATCHING:
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
            break
          case NbClient.LockStates.MOTOR_BLOCKED:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.JAMMED
            this.values.statusFault = this.Characteristics.hap.StatusFault.GENERAL_FAULT
            break
          case NbClient.LockStates.UNDEFINED:
          default:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNKNOWN
            this.values.statusFault = this.Characteristics.hap.StatusFault.GENERAL_FAULT
            break
        }
      }
      this.values.lastUpdated = dateToString(state.timestamp)
    } catch (error) {
      this.warn(error)
    }
  }
}

class Latch extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name + ' Latch'
    params.Service = nbAccessory.Services.hap.LockMechanism
    params.subtype = 1
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.LockCurrentState
    })
    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.LockTargetState
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      if (value === this.Characteristics.hap.LockTargetState.UNSECURED) {
        nbAccessory.update({ state: NbClient.LockStates.UNLATCHING })
        setTimeout(() => {
          nbAccessory.update({ state: NbClient.LockStates.UNLATCHED })
        }, 3000)
        const response = await nbAccessory.client.lockAction(
          nbAccessory.id, NbClient.DeviceTypes.SMARTLOCK,
          NbClient.LockActions.UNLATCH
        )
        if (response != null && response.body.success) {
          nbAccessory.update(response.body)
          nbAccessory.update({ state: NbClient.LockStates.UNLOCKED })
        }
      }
    })
  }

  update (state) {
    try {
      if (state.state != null) {
        switch (state.state) {
          case NbClient.LockStates.UNLATCHED:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.UNSECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            break
          case NbClient.LockStates.UNLATCHING:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
            break
          case NbClient.LockStates.UNLOCKED:
          case NbClient.LockStates.UNLOCKED_LOCK_N_GO:
          case NbClient.LockStates.LOCKING:
          case NbClient.LockStates.LOCKED:
          case NbClient.LockStates.UNLOCKING:
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
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
    } catch (error) {
      this.warn(error)
    }
  }
}

class DoorSensor extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name + ' Sensor'
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
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault,
      value: this.Characteristics.hap.StatusFault.NO_FAULT
    })
  }

  update (state) {
    if (state.doorsensorState) {
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
  }
}

class DoorBell extends homebridgeLib.ServiceDelegate {
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
  }

  update (state) {
    if (state.ringactionState) {
      this.values.programmableSwitchEvent =
        this.Characteristics.hap.ProgrammableSwitchEvent.SINGLE_PRESS
    }
    this.values.lastUpdated = dateToString(state.ringactionTimestamp)
  }
}

class Opener extends homebridgeLib.ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.LockMechanism
    super(nbAccessory, params)

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.LockCurrentState,
      value: this.Characteristics.hap.LockCurrentState.SECURED
    })
    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.LockTargetState,
      value: this.Characteristics.hap.LockTargetState.SECURED
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      if (value === this.Characteristics.hap.LockTargetState.UNSECURED) {
        const response = await nbAccessory.client.lockAction(
          nbAccessory.id, NbClient.DeviceTypes.OPENER,
          NbClient.OpenerActions.OPEN
        )
        if (response != null && response.body.success) {
          this.values.currentState = value
          nbAccessory.update(response.body)
        }
      }
      setTimeout(() => {
        this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
        this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
      }, 500)
    })
    this.addCharacteristicDelegate({
      key: 'rto',
      Characteristic: this.Characteristics.my.RingToOpen
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      await nbAccessory.client.lockAction(
        nbAccessory.id, NbClient.DeviceTypes.OPENER, value
          ? NbClient.OpenerActions.ACTIVATE_RTO
          : NbClient.OpenerActions.DEACTIVATE_RTO
      )
    })
    this.addCharacteristicDelegate({
      key: 'cm',
      Characteristic: this.Characteristics.my.ContinuousMode
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      await nbAccessory.client.lockAction(
        nbAccessory.id, NbClient.DeviceTypes.OPENER, value
          ? NbClient.OpenerActions.ACTIVATE_CM
          : NbClient.OpenerActions.DEACTIVATE_CM
      )
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
    if (state.mode != null) {
      this.values.cm = state.mode === NbClient.OpenerModes.CONTINUOUS_MODE
    }
    if (state.state != null) {
      switch (state.state) {
        case NbClient.OpenerStates.ONLINE:
        case NbClient.OpenerStates.RTO_ACTIVE:
          this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
          this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
          this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
          break
        case NbClient.OpenerStates.OPEN:
          this.values.currentState = this.Characteristics.hap.LockCurrentState.UNSECURED
          this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
          this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
          break
        case NbClient.OpenerStates.OPENING:
          this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
          this.values.targetState = this.Characteristics.hap.LockTargetState.UNSECURED
          this.values.statusFault = this.Characteristics.hap.StatusFault.NO_FAULT
          break
        case NbClient.OpenerStates.UNTRAINED:
        case NbClient.OpenerStates.BOOT_RUN:
        case NbClient.OpenerStates.UNDEFINED:
        default:
          this.values.currentState = this.Characteristics.hap.LockCurrentState.UNKNOWN
          this.values.statusFault = this.Characteristics.hap.StatusFault.GENERAL_FAULT
          break
      }
      this.values.rto = state.state === NbClient.OpenerStates.RTO_ACTIVE
      this.values.lastUpdated = dateToString(state.timestamp)
    }
  }
}

module.exports = NbService
