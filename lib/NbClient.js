// homebridge-nb/lib/NbClient.js
// Copyright © 2020-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for Nuki Bridge.

'use strict'

const crypto = require('crypto')
const homebridgeLib = require('homebridge-lib')

class NbClient extends homebridgeLib.HttpClient {
  static get DeviceTypes () {
    return { SMARTLOCK: 0, OPENER: 2 }
  }

  static get LockStates () {
    return {
      UNCALIBRATED: 0,
      LOCKED: 1,
      UNLOCKING: 2,
      UNLOCKED: 3,
      LOCKING: 4,
      UNLATCHED: 5,
      UNLOCKED_LOCK_N_GO: 6,
      UNLATCHING: 7,
      MOTOR_BLOCKED: 254,
      UNDEFINED: 255
    }
  }

  static get DoorSensorStates () {
    return {
      DEACTIVATED: 0,
      CLOSED: 2,
      OPEN: 3,
      UNKNOWN: 4,
      CALIBRATING: 5
    }
  }

  static get LockActions () {
    return {
      UNLOCK: 1,
      LOCK: 2,
      UNLATCH: 3,
      LOCK_N_GO: 4,
      LOCK_N_GO_WITH_UNLATCH: 5
    }
  }

  static get OpenerModes () {
    return {
      DOOR_MODE: 2,
      CONTINUOUS_MODE: 3
    }
  }

  static get OpenerStates () {
    return {
      UNTRAINED: 0,
      ONLINE: 1,
      RTO_ACTIVE: 3,
      OPEN: 5,
      OPENING: 7,
      BOOT_RUN: 253,
      UNDEFINED: 255
    }
  }

  static get OpenerActions () {
    return {
      ACTIVATE_RTO: 1,
      DEACTIVATE_RTO: 2,
      OPEN: 3,
      ACTIVATE_CM: 4,
      DEACTIVATE_CM: 5
    }
  }

  constructor (params = {}) {
    const _params = {
      hashedToken: true,
      port: 8080,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(_params)
    optionParser
      .hostKey('host')
      .intKey('timeout', 1, 60)
      .stringKey('token')
      .parse(params)
    super({
      host: _params.hostname + ':' + _params.port,
      json: true,
      keepAlive: true,
      maxSockets: 1,
      timeout: _params.timeout
    })
    this._params = _params
    this._jsonFormatter = new homebridgeLib.JsonFormatter()
  }

  get id () { return this._params.id }
  get name () { return 'Nuki_Bridge_' + this._params.id }
  get firmware () { return this._params.firmware }
  get token () { return this._params.token }

  async auth () {
    const response = await this._get('/auth')
    if (response.body.success) {
      this._params.token = response.body.token
      return response.body.token
    }
    throw new Error('Nuki bridge button not pressed')
  }

  async info () { return this._get('/info') }
  async log () { return this._get('/log') }
  async reboot () { return this._get('/reboot') }
  async list () { return this._get('/list') }

  async lockState (nukiId, deviceType) {
    return this._get('/lockState', { nukiId: nukiId, deviceType: deviceType })
  }

  async lock (nukiId, deviceType) {
    return this._get('/lock', { nukiId: nukiId, deviceType: deviceType })
  }

  async unlock (nukiId, deviceType) {
    return this._get('/unlock', { nukiId: nukiId, deviceType: deviceType })
  }

  async lockAction (nukiId, deviceType, action) {
    return this._get(
      '/lockAction', { nukiId: nukiId, deviceType: deviceType, action: action }
    )
  }

  async init () {
    const response = await this.info()
    this._params.id = response.body.ids.serverId.toString(16).toUpperCase()
    this._params.firmware = response.body.versions.firmwareVersion
  }

  async callbackAdd (url) {
    return this._get('/callback/add', { url: encodeURIComponent(url) })
  }

  async callbackList () { return this._get('/callback/list') }
  async callbackRemove (id) { return this._get('/callback/remove', { id: id }) }

  async _get (resource, params = {}) {
    // Append parameters
    let separator = '?'
    for (const param in params) {
      resource += separator + param + '=' + params[param]
      separator = '&'
    }
    let suffix = ''
    if (resource !== '/auth') {
      if (this._params.hashedToken) {
        // Append hashed token
        const hash = crypto.createHash('sha256')
        const date = new Date().toISOString()
        const ts = date.slice(0, 19) + 'Z'
        const rnr = '1' + date.slice(20, 23)
        hash.update([ts, rnr, this._params.token].join(','))
        suffix = separator + 'ts=' + ts + '&rnr=' + rnr +
          '&hash=' + hash.digest('hex')
      } else {
        suffix = separator + 'token=' + this._params.token
      }
    }
    return super.get(resource, undefined, suffix)
  }
}

module.exports = NbClient
