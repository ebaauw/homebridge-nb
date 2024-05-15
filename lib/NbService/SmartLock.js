// homebridge-nb/lib/NbService/SmartLock.js
// Copyright © 2020-2024 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

import { NbClient } from 'hb-nb-tools/NbClient'

import { NbService } from '../NbService.js'

const { dateToString } = NbService

class SmartLock extends ServiceDelegate {
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
        const response = await nbAccessory.lockAction(
          value === this.Characteristics.hap.LockTargetState.UNSECURED
            ? NbClient.LockActions.UNLOCK
            : NbClient.LockActions.LOCK
        )
        if (response != null && response.body.success) {
          this.values.currentState = value
          nbAccessory.update(response.body)
        }
      } catch (error) { this.error(error) }
    }).on('didTouch', async (value, fromHomeKit) => {
      try {
        if (!fromHomeKit) {
          return
        }
        if (value === this.Characteristics.hap.LockTargetState.UNSECURED) {
          await nbAccessory.lockAction(NbClient.LockActions.UNLATCH)
        }
      } catch (error) { this.error(error) }
    })
    this.addCharacteristicDelegate({
      key: 'unlatch',
      Characteristic: this.Characteristics.my.Unlatch,
      value: false
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (!fromHomeKit) {
          return
        }
        if (value) {
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
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault,
      value: this.Characteristics.hap.StatusFault.NO_FAULT
    })
    if (this.platform.config.latch) {
      this.addCharacteristicDelegate({
        key: 'label',
        Characteristic: this.Characteristics.hap.ServiceLabelIndex,
        value: 1
      })
    }
  }

  update (state) {
    if (state.state != null) {
      // Workaround: bridge state isn't always updated
      this.needRefresh = this.previousState === state.state && [
        NbClient.LockStates.UNLOCKED_LOCK_N_GO,
        NbClient.LockStates.LOCKING,
        NbClient.LockStates.UNLOCKING,
        NbClient.LockStates.UNLATCHING
      ].includes(state.state)
      this.previousState = state.state
      // End workaround
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
      this.values.unlatch = [
        NbClient.LockStates.UNLATCHED, NbClient.LockStates.UNLATCHING
      ].includes(state.state)
    }
    if (state.timestamp != null) {
      this.values.lastUpdated = dateToString(state.timestamp)
    }
  }
}

NbService.SmartLock = SmartLock
