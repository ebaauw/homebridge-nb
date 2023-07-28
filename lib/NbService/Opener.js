// homebridge-nb/lib/NbService/Opener.js
// Copyright © 2020-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const { NbClient } = require('hb-nb-tools')
const { dateToString } = require('../NbService')

class Opener extends ServiceDelegate {
  constructor (nbAccessory, params = {}) {
    params.name = nbAccessory.name
    params.Service = nbAccessory.Services.hap.LockMechanism
    params.primaryService = true
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
      try {
        if (!fromHomeKit) {
          return
        }
        if (value === this.Characteristics.hap.LockTargetState.UNSECURED) {
          const response = await nbAccessory.client.lockAction(
            nbAccessory.id, nbAccessory.deviceType,
            NbClient.OpenerActions.OPEN
          )
          if (response != null && response.body.success) {
            this.values.currentState = value
            nbAccessory.update(response.body)
          }
        }
        if (this.platform.config.openerResetTimeout > 0) {
          setTimeout(() => {
            this.values.currentState = this.Characteristics.hap.LockCurrentState.SECURED
            this.values.targetState = this.Characteristics.hap.LockTargetState.SECURED
          }, this.platform.config.openerResetTimeout)
        }
      } catch (error) { this.error(error) }
    })
    this.addCharacteristicDelegate({
      key: 'rto',
      Characteristic: this.Characteristics.my.RingToOpen
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (!fromHomeKit) {
          return
        }
        await nbAccessory.client.lockAction(
          nbAccessory.id, nbAccessory.deviceType, value
            ? NbClient.OpenerActions.ACTIVATE_RTO
            : NbClient.OpenerActions.DEACTIVATE_RTO
        )
      } catch (error) { this.error(error) }
    })
    this.addCharacteristicDelegate({
      key: 'cm',
      Characteristic: this.Characteristics.my.ContinuousMode
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (!fromHomeKit) {
          return
        }
        await nbAccessory.client.lockAction(
          nbAccessory.id, nbAccessory.deviceType, value
            ? NbClient.OpenerActions.ACTIVATE_CM
            : NbClient.OpenerActions.DEACTIVATE_CM
        )
      } catch (error) { this.error(error) }
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
    }
    if (state.timestamp != null) {
      this.values.lastUpdated = dateToString(state.timestamp)
    }
  }
}

module.exports = Opener
