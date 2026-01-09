// homebridge-nb/lib/NbService/Latch.js
// Copyright © 2020-2026 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

import { NbClient } from 'hb-nb-tools/NbClient'

import { NbService } from '../NbService.js'

class Latch extends ServiceDelegate {
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
      try {
        if (!fromHomeKit) {
          return
        }
        if (value === this.Characteristics.hap.LockTargetState.UNSECURED) {
          nbAccessory.update({ state: NbClient.LockStates.UNLATCHING })
          setTimeout(() => {
            nbAccessory.update({ state: NbClient.LockStates.UNLATCHED })
          }, 3000)
          const response = await nbAccessory.lockAction(NbClient.LockActions.UNLATCH)
          if (response != null && response.body.success) {
            nbAccessory.update(response.body)
            nbAccessory.update({ state: NbClient.LockStates.UNLOCKED })
          }
        }
      } catch (error) { this.error(error) }
    })
    this.addCharacteristicDelegate({
      key: 'label',
      Characteristic: this.Characteristics.hap.ServiceLabelIndex,
      value: 2
    })
  }

  update (state) {
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
  }
}

NbService.Latch = Latch
